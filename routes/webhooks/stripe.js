const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { updateSubscription, getSubscription } = require("../../services/subscriptionService");
const { saveTransaction, updateTransactionStatus } = require("../../services/reportService");
const { createInvoice } = require("../../services/invoiceService");
const { logBillingEvent } = require("../../services/billingAuditService");
const { sendPaymentFailed } = require("../../services/emailService");
const { getPaymentMethodsContainer } = require("../../services/billingCosmosClient");

// NOTE: This route is mounted with express.raw() body parser in server.js
// so req.body is a raw Buffer here — DO NOT parse it as JSON elsewhere.

router.post("/", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  try {
    switch (event.type) {

      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const doctorId = pi.metadata?.doctorId;
        if (!doctorId) break;

        // Update transaction status
        await updateTransactionStatus(doctorId, pi.id, "succeeded");

        // Retrieve payment method details for the invoice
        let last4 = null, brand = null, pmType = "stripe_card";
        if (pi.payment_method) {
          try {
            const pm = await stripe.paymentMethods.retrieve(pi.payment_method);
            last4 = pm.card?.last4;
            brand = pm.card?.brand;
          } catch (_) {}
        }

        // Fetch subscription + doctor for invoice generation
        const sub = await getSubscription(doctorId);
        const txRecord = {
          transactionId: pi.id,
          paymentMethodType: pmType,
          paymentMethodLast4: last4,
          paymentMethodBrand: brand,
        };

        if (sub) {
          const lineItems = [
            {
              description: `${(sub.modality || "").replace("_", " ")} subscription`,
              amount: pi.amount / 100,
            },
          ];
          await createInvoice(doctorId, { doctorId }, sub, txRecord, lineItems);
        }

        await logBillingEvent(doctorId, "payment_succeeded", "stripe", { piId: pi.id, amount: pi.amount / 100 });
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const doctorId = pi.metadata?.doctorId;
        if (!doctorId) break;

        await updateTransactionStatus(doctorId, pi.id, "failed", {
          failureReason: pi.last_payment_error?.message || "Unknown",
        });
        await sendPaymentFailed(doctorId);
        await logBillingEvent(doctorId, "payment_failed", "stripe", {
          piId: pi.id,
          reason: pi.last_payment_error?.message,
        });
        break;
      }

      case "invoice.paid": {
        // Stripe recurring subscription invoice paid
        const inv = event.data.object;
        const stripeCustomerId = inv.customer;

        // Find doctor by stripeCustomerId
        const pmContainer = getPaymentMethodsContainer();
        const { resources } = await pmContainer.items
          .query({
            query: "SELECT * FROM c WHERE c.stripeCustomerId = @cid",
            parameters: [{ name: "@cid", value: stripeCustomerId }],
          })
          .fetchAll();

        if (!resources.length) break;
        const doctorId = resources[0].doctorId;
        const sub = await getSubscription(doctorId);

        // Save transaction record
        const txData = {
          transactionId: inv.payment_intent || inv.id,
          type: "renewal",
          subscriptionModality: sub?.modality || null,
          paymentMethodType: "stripe_card",
          paymentMethodLast4: resources[0].last4,
          paymentMethodBrand: resources[0].brand,
          amount: inv.amount_paid / 100,
          currency: "usd",
          status: "succeeded",
          description: `Subscription renewal — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
          stripePaymentIntentId: inv.payment_intent || null,
        };

        const tx = await saveTransaction(doctorId, txData);

        // Generate invoice + email
        const lineItems = inv.lines.data.map((li) => ({
          description: li.description || "Subscription",
          amount: li.amount / 100,
        }));
        await createInvoice(doctorId, { doctorId }, sub, tx, lineItems);

        await logBillingEvent(doctorId, "payment_succeeded", "stripe", { invoiceId: inv.id });
        break;
      }

      case "customer.subscription.updated": {
        const stripeSub = event.data.object;
        const stripeCustomerId = stripeSub.customer;

        const pmContainer = getPaymentMethodsContainer();
        const { resources } = await pmContainer.items
          .query({
            query: "SELECT * FROM c WHERE c.stripeCustomerId = @cid",
            parameters: [{ name: "@cid", value: stripeCustomerId }],
          })
          .fetchAll();

        if (!resources.length) break;
        const doctorId = resources[0].doctorId;

        const statusMap = {
          active: "active",
          past_due: "past_due",
          canceled: "cancelled",
          unpaid: "past_due",
          trialing: "trial",
        };

        await updateSubscription(doctorId, {
          status: statusMap[stripeSub.status] || stripeSub.status,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSub = event.data.object;
        const stripeCustomerId = stripeSub.customer;

        const pmContainer = getPaymentMethodsContainer();
        const { resources } = await pmContainer.items
          .query({
            query: "SELECT * FROM c WHERE c.stripeCustomerId = @cid",
            parameters: [{ name: "@cid", value: stripeCustomerId }],
          })
          .fetchAll();

        if (!resources.length) break;
        const doctorId = resources[0].doctorId;

        await updateSubscription(doctorId, { status: "cancelled" });
        await logBillingEvent(doctorId, "subscription_cancelled", "stripe", {});
        break;
      }

      case "payment_method.updated": {
        const pm = event.data.object;
        if (!pm.card) break;

        const pmContainer = getPaymentMethodsContainer();
        const { resources } = await pmContainer.items
          .query({
            query: "SELECT * FROM c WHERE c.stripePaymentMethodId = @pmId",
            parameters: [{ name: "@pmId", value: pm.id }],
          })
          .fetchAll();

        if (!resources.length) break;
        const doc = resources[0];
        const updated = {
          ...doc,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year,
          last4: pm.card.last4,
          brand: pm.card.brand,
        };
        await pmContainer.item(doc.id, doc.doctorId).replace(updated);
        break;
      }

      default:
        // Unhandled event — ignore
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler error [${event.type}]:`, err.message);
    // Still return 200 so Stripe doesn't retry indefinitely
  }

  res.json({ received: true });
});

module.exports = router;
