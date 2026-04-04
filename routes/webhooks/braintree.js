const express = require("express");
const router = express.Router();
const braintree = require("braintree");
const { saveTransaction, updateTransactionStatus } = require("../../services/reportService");
const { createInvoice } = require("../../services/invoiceService");
const { logBillingEvent } = require("../../services/billingAuditService");
const { sendPaymentFailed } = require("../../services/emailService");
const { getSubscription } = require("../../services/subscriptionService");
const { getPaymentMethodsContainer } = require("../../services/billingCosmosClient");

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment[
    process.env.BRAINTREE_ENVIRONMENT === "production" ? "Production" : "Sandbox"
  ],
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

// NOTE: Mounted with express.urlencoded() in server.js
router.post("/", async (req, res) => {
  const { bt_signature, bt_payload } = req.body;

  if (!bt_signature || !bt_payload) {
    return res.status(400).json({ error: "Missing Braintree webhook fields." });
  }

  let notification;
  try {
    notification = await gateway.webhookNotification.parse(bt_signature, bt_payload);
  } catch (err) {
    console.error("Braintree webhook parse failed:", err.message);
    return res.status(400).json({ error: "Invalid Braintree webhook." });
  }

  try {
    const { kind, subject } = notification;

    switch (kind) {

      case braintree.WebhookNotification.Kind.TransactionSettled: {
        const tx = subject.transaction;
        const braintreeCustomerId = tx.customer?.id;

        // Look up doctorId by braintreeCustomerId
        const pmContainer = getPaymentMethodsContainer();
        const { resources } = await pmContainer.items
          .query({
            query: "SELECT * FROM c WHERE c.braintreeCustomerId = @cid",
            parameters: [{ name: "@cid", value: braintreeCustomerId }],
          })
          .fetchAll();

        if (!resources.length) break;
        const doctorId = resources[0].doctorId;
        const sub = await getSubscription(doctorId);

        const txData = {
          transactionId: tx.id,
          type: "subscription",
          subscriptionModality: sub?.modality || null,
          paymentMethodType: "venmo",
          paymentMethodLast4: null,
          amount: parseFloat(tx.amount),
          currency: "usd",
          status: "succeeded",
          braintreeTransactionId: tx.id,
          description: "Venmo subscription payment",
        };

        const saved = await saveTransaction(doctorId, txData);

        const lineItems = [{ description: "Venmo subscription payment", amount: parseFloat(tx.amount) }];
        await createInvoice(doctorId, { doctorId }, sub, saved, lineItems);

        await logBillingEvent(doctorId, "payment_succeeded", "braintree", { btTxId: tx.id });
        break;
      }

      case braintree.WebhookNotification.Kind.TransactionSettlementDeclined: {
        const tx = subject.transaction;
        const braintreeCustomerId = tx.customer?.id;

        const pmContainer = getPaymentMethodsContainer();
        const { resources } = await pmContainer.items
          .query({
            query: "SELECT * FROM c WHERE c.braintreeCustomerId = @cid",
            parameters: [{ name: "@cid", value: braintreeCustomerId }],
          })
          .fetchAll();

        if (!resources.length) break;
        const doctorId = resources[0].doctorId;

        await updateTransactionStatus(doctorId, tx.id, "failed", {
          failureReason: "Braintree settlement declined",
        });
        await sendPaymentFailed(doctorId);
        await logBillingEvent(doctorId, "payment_failed", "braintree", { btTxId: tx.id });
        break;
      }

      case braintree.WebhookNotification.Kind.SubscriptionChargedUnsuccessfully: {
        const btSub = subject.subscription;
        const braintreeCustomerId = btSub.planId; // may vary — adapt to actual payload

        await logBillingEvent("unknown", "payment_failed", "braintree", {
          btSubId: btSub.id,
          note: "Braintree subscription charge failed",
        });
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error(`Braintree webhook handler error [${notification?.kind}]:`, err.message);
  }

  res.status(200).send("OK");
});

module.exports = router;
