const cron = require("node-cron");
const { getSubscriptionsByStatus, updateSubscription } = require("./subscriptionService");
const { saveTransaction } = require("./reportService");
const {
  sendExpiryReminder,
  sendExpiryNotice,
  sendAnnualRenewalReminder,
  sendMonthlyRenewalReminder,
  sendTrialReminder,
  sendTrialExpired,
  sendPaymentFailed,
} = require("./emailService");
const { logBillingEvent } = require("./billingAuditService");
const { getPaymentMethodsContainer } = require("./billingCosmosClient");
const braintree = require("braintree");
require("dotenv").config();

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment[
    process.env.BRAINTREE_ENVIRONMENT === "production" ? "Production" : "Sandbox"
  ],
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

function daysUntil(isoDate) {
  const now = new Date();
  const target = new Date(isoDate);
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

// ─── Check & expire one-time subscriptions ────────────────────────────────────
async function checkOneTimeExpiry() {
  console.log("[CRON] checkOneTimeExpiry running");
  const actives = await getSubscriptionsByStatus("active");

  for (const sub of actives) {
    if (sub.modality !== "one_time") continue;
    const days = daysUntil(sub.currentPeriodEnd);

    if (days <= 0) {
      await updateSubscription(sub.doctorId, { status: "expired" });
      await sendExpiryNotice(sub.doctorId);
      await logBillingEvent(sub.doctorId, "subscription_expired", "cron", { modality: "one_time" });
    }
  }
}

// ─── Send one-time expiry reminders ──────────────────────────────────────────
async function sendOneTimeReminders() {
  console.log("[CRON] sendOneTimeReminders running");
  const actives = await getSubscriptionsByStatus("active");

  for (const sub of actives) {
    if (sub.modality !== "one_time") continue;
    const days = daysUntil(sub.currentPeriodEnd);

    if (days === 7 || days === 2) {
      await sendExpiryReminder(sub.doctorId, days, sub.currentPeriodEnd);
    }
  }
}

// ─── Send annual renewal reminders (30 days before) ──────────────────────────
async function sendAnnualRenewalReminders() {
  console.log("[CRON] sendAnnualRenewalReminders running");
  const actives = await getSubscriptionsByStatus("active");

  for (const sub of actives) {
    if (sub.modality !== "annual") continue;
    const days = daysUntil(sub.currentPeriodEnd);

    if (days === 30) {
      await sendAnnualRenewalReminder(sub.doctorId, sub.currentPeriodEnd);
    }
  }
}

// ─── Send monthly renewal reminders (3 days before) ──────────────────────────
async function sendMonthlyRenewalReminders() {
  console.log("[CRON] sendMonthlyRenewalReminders running");
  const actives = await getSubscriptionsByStatus("active");

  for (const sub of actives) {
    if (sub.modality !== "monthly") continue;
    const days = daysUntil(sub.currentPeriodEnd);

    if (days === 3) {
      await sendMonthlyRenewalReminder(sub.doctorId, sub.currentPeriodEnd);
    }
  }
}

// ─── Check & handle trial expiry ─────────────────────────────────────────────
async function checkTrialExpiry() {
  console.log("[CRON] checkTrialExpiry running");
  const trials = await getSubscriptionsByStatus("trial");

  for (const sub of trials) {
    const days = daysUntil(sub.trialEndDate);

    if (days <= 0) {
      // Check if doctor has a saved payment method
      const pmContainer = getPaymentMethodsContainer();
      const { resources: pms } = await pmContainer.items
        .query({
          query: "SELECT * FROM c WHERE c.doctorId = @doctorId",
          parameters: [{ name: "@doctorId", value: sub.doctorId }],
        })
        .fetchAll();

      if (pms.length > 0) {
        // Payment method on file — convert will happen via subscription creation flow
        // Just expire the trial; doctor must confirm plan selection via UI
        await updateSubscription(sub.doctorId, { status: "expired" });
        await sendTrialExpired(sub.doctorId);
      } else {
        // No payment method — restrict access
        await updateSubscription(sub.doctorId, { status: "expired" });
        await sendTrialExpired(sub.doctorId);
      }

      await logBillingEvent(sub.doctorId, "trial_expired", "cron", {});
    }
  }
}

// ─── Send trial reminders ─────────────────────────────────────────────────────
async function sendTrialReminders() {
  console.log("[CRON] sendTrialReminders running");
  const trials = await getSubscriptionsByStatus("trial");

  for (const sub of trials) {
    const days = daysUntil(sub.trialEndDate);

    if (days === 7 || days === 2) {
      await sendTrialReminder(sub.doctorId, days, sub.trialEndDate);
    }
  }
}

// ─── Process Venmo recurring renewals ────────────────────────────────────────
// Stripe handles card renewals automatically. Venmo/Braintree must be charged manually.
async function processVenmoRenewals() {
  console.log("[CRON] processVenmoRenewals running");
  const actives = await getSubscriptionsByStatus("active");

  for (const sub of actives) {
    if (sub.activePaymentMethodType !== "venmo") continue;

    const days = daysUntil(sub.currentPeriodEnd);
    if (days > 0) continue; // not due yet

    // Find Venmo payment method
    const pmContainer = getPaymentMethodsContainer();
    const { resources: pms } = await pmContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.doctorId = @doctorId AND c.type = @type",
        parameters: [
          { name: "@doctorId", value: sub.doctorId },
          { name: "@type", value: "venmo" },
        ],
      })
      .fetchAll();

    const pm = pms.find((p) => p.isDefault) || pms[0];
    if (!pm?.braintreePaymentMethodToken) {
      await logBillingEvent(sub.doctorId, "payment_failed", "cron", {
        reason: "No Venmo payment method found for renewal",
      });
      await updateSubscription(sub.doctorId, { status: "past_due" });
      await sendPaymentFailed(sub.doctorId);
      continue;
    }

    const amount = sub.modality === "annual"
      ? parseFloat(process.env.SUBSCRIPTION_PRICE_ANNUAL || "990")
      : parseFloat(process.env.SUBSCRIPTION_PRICE_MONTHLY || "99");

    try {
      const result = await gateway.transaction.sale({
        amount: amount.toFixed(2),
        paymentMethodToken: pm.braintreePaymentMethodToken,
        options: { submitForSettlement: true },
      });

      if (result.success) {
        // Advance subscription period
        const now = new Date().toISOString();
        const newEnd = sub.modality === "annual"
          ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString()
          : new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString();

        await updateSubscription(sub.doctorId, {
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: newEnd,
        });

        await saveTransaction(sub.doctorId, {
          transactionId: result.transaction.id,
          type: "renewal",
          subscriptionModality: sub.modality,
          paymentMethodType: "venmo",
          amount,
          currency: "usd",
          status: "succeeded",
          braintreeTransactionId: result.transaction.id,
          description: `Venmo ${sub.modality} renewal`,
        });

        await logBillingEvent(sub.doctorId, "payment_succeeded", "cron", {
          btTxId: result.transaction.id,
          modality: sub.modality,
        });
      } else {
        await updateSubscription(sub.doctorId, { status: "past_due" });
        await sendPaymentFailed(sub.doctorId);
        await logBillingEvent(sub.doctorId, "payment_failed", "cron", {
          reason: result.message,
        });
      }
    } catch (err) {
      console.error("Venmo renewal charge failed:", err.message);
      await updateSubscription(sub.doctorId, { status: "past_due" });
    }
  }
}

// ─── Start all jobs ───────────────────────────────────────────────────────────
function startAllJobs() {
  // Run daily at midnight UTC
  cron.schedule("0 0 * * *", checkOneTimeExpiry, { timezone: "UTC" });
  cron.schedule("0 0 * * *", sendOneTimeReminders, { timezone: "UTC" });
  cron.schedule("0 0 * * *", sendAnnualRenewalReminders, { timezone: "UTC" });
  cron.schedule("0 0 * * *", sendMonthlyRenewalReminders, { timezone: "UTC" });
  cron.schedule("0 0 * * *", checkTrialExpiry, { timezone: "UTC" });
  cron.schedule("0 0 * * *", sendTrialReminders, { timezone: "UTC" });
  cron.schedule("0 0 * * *", processVenmoRenewals, { timezone: "UTC" });

  console.log("[CRON] All billing cron jobs scheduled.");
}

module.exports = {
  startAllJobs,
  // Export individual jobs for manual testing
  checkOneTimeExpiry,
  sendOneTimeReminders,
  sendAnnualRenewalReminders,
  sendMonthlyRenewalReminders,
  checkTrialExpiry,
  sendTrialReminders,
  processVenmoRenewals,
};
