const express = require("express");
const router = express.Router();
const billingAccess = require("../middleware/billingAccess");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const {
  getSubscription,
  createSubscription,
  startTrial,
  getTrialStatus,
  cancelSubscription,
  convertSubscription,
  flagDowngrade,
} = require("../services/subscriptionService");
const { getPaymentMethodsContainer } = require("../services/billingCosmosClient");

// ─── GET /api/subscriptions/current ──────────────────────────────────────────
router.get("/current", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const sub = await getSubscription(doctorId);
    if (!sub) return res.status(404).json({ message: "No subscription found." });
    res.json(sub);
  } catch (err) {
    console.error("GET /subscriptions/current:", err);
    res.status(500).json({ error: "Failed to fetch subscription." });
  }
});

// ─── POST /api/subscriptions ──────────────────────────────────────────────────
// Body: { modality: "monthly"|"annual"|"one_time", paymentMethodId: "pm_xxx" }
router.post("/", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { modality, paymentMethodId } = req.body;

    if (!["monthly", "annual", "one_time"].includes(modality)) {
      return res.status(400).json({ error: "modality must be monthly, annual, or one_time." });
    }
    if (!paymentMethodId) {
      return res.status(400).json({ error: "paymentMethodId is required." });
    }

    // Check for existing active sub
    const existing = await getSubscription(doctorId);
    if (existing && ["active", "trial"].includes(existing.status)) {
      return res.status(409).json({ error: "Doctor already has an active subscription." });
    }

    // Ensure Stripe customer exists (look up saved payment method to get customerId)
    const pmContainer = getPaymentMethodsContainer();
    const { resources: pmDocs } = await pmContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.doctorId = @doctorId AND c.stripePaymentMethodId = @pmId",
        parameters: [
          { name: "@doctorId", value: doctorId },
          { name: "@pmId", value: paymentMethodId },
        ],
      })
      .fetchAll();

    if (!pmDocs.length) {
      return res.status(404).json({ error: "Payment method not found. Please add a card first." });
    }

    const pmDoc = pmDocs[0];
    const stripeCustomerId = pmDoc.stripeCustomerId;

    let stripeSubscriptionId = null;

    if (modality === "one_time") {
      // Single charge — no Stripe subscription
      const priceInCents = Math.round(parseFloat(process.env.SUBSCRIPTION_PRICE_MONTHLY) * 100);
      await stripe.paymentIntents.create({
        amount: priceInCents,
        currency: "usd",
        customer: stripeCustomerId,
        payment_method: paymentMethodId,
        confirm: true,
        description: "SEISMIC One-Time 1-Month Subscription",
        metadata: { doctorId, modality },
        off_session: true,
      });
    } else {
      // Recurring — Stripe Subscription manages the cycle
      const priceId = modality === "annual"
        ? process.env.STRIPE_PRICE_ANNUAL
        : process.env.STRIPE_PRICE_MONTHLY;

      const stripeSub = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        default_payment_method: paymentMethodId,
        metadata: { doctorId, modality },
      });

      stripeSubscriptionId = stripeSub.id;
    }

    const sub = await createSubscription(
      doctorId,
      modality,
      stripeCustomerId,
      stripeSubscriptionId,
      "stripe_card"
    );

    res.status(201).json(sub);
  } catch (err) {
    console.error("POST /subscriptions:", err);
    res.status(500).json({ error: err.message || "Failed to create subscription." });
  }
});

// ─── POST /api/subscriptions/trial ───────────────────────────────────────────
router.post("/trial", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const sub = await startTrial(doctorId);
    res.status(201).json(sub);
  } catch (err) {
    console.error("POST /subscriptions/trial:", err);
    res.status(400).json({ error: err.message });
  }
});

// ─── GET /api/subscriptions/trial-status ─────────────────────────────────────
router.get("/trial-status", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const status = await getTrialStatus(doctorId);
    res.json(status);
  } catch (err) {
    console.error("GET /subscriptions/trial-status:", err);
    res.status(500).json({ error: "Failed to get trial status." });
  }
});

// ─── PATCH /api/subscriptions/cancel ─────────────────────────────────────────
// Body: { immediate: true|false }  — default false (cancel at period end)
router.patch("/cancel", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { immediate = false } = req.body;

    const sub = await getSubscription(doctorId);
    if (!sub) return res.status(404).json({ error: "No subscription found." });

    // Cancel on Stripe if recurring
    if (sub.stripeSubscriptionId) {
      if (immediate) {
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      } else {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      }
    }

    const updated = await cancelSubscription(doctorId, immediate);
    res.json(updated);
  } catch (err) {
    console.error("PATCH /subscriptions/cancel:", err);
    res.status(500).json({ error: err.message || "Failed to cancel subscription." });
  }
});

// ─── PATCH /api/subscriptions/convert ────────────────────────────────────────
// Body: { modality: "monthly"|"annual", paymentMethodId: "pm_xxx" }
router.patch("/convert", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { modality, paymentMethodId } = req.body;

    if (!["monthly", "annual"].includes(modality)) {
      return res.status(400).json({ error: "modality must be monthly or annual." });
    }

    const existing = await getSubscription(doctorId);
    if (!existing) return res.status(404).json({ error: "No subscription found." });

    const pmContainer = getPaymentMethodsContainer();
    const { resources: pmDocs } = await pmContainer.items
      .query({
        query: "SELECT * FROM c WHERE c.doctorId = @doctorId AND c.stripePaymentMethodId = @pmId",
        parameters: [
          { name: "@doctorId", value: doctorId },
          { name: "@pmId", value: paymentMethodId },
        ],
      })
      .fetchAll();

    if (!pmDocs.length) {
      return res.status(404).json({ error: "Payment method not found." });
    }

    const stripeCustomerId = pmDocs[0].stripeCustomerId;
    const priceId = modality === "annual"
      ? process.env.STRIPE_PRICE_ANNUAL
      : process.env.STRIPE_PRICE_MONTHLY;

    const stripeSub = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      metadata: { doctorId, modality },
    });

    const updated = await convertSubscription(doctorId, modality, stripeSub.id);
    res.json(updated);
  } catch (err) {
    console.error("PATCH /subscriptions/convert:", err);
    res.status(500).json({ error: err.message || "Failed to convert subscription." });
  }
});

// ─── PATCH /api/subscriptions/downgrade ──────────────────────────────────────
// Marks annual → monthly at next renewal
router.patch("/downgrade", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;

    const sub = await getSubscription(doctorId);
    if (!sub) return res.status(404).json({ error: "No subscription found." });

    // Update Stripe subscription to monthly price at renewal
    if (sub.stripeSubscriptionId) {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const currentItemId = stripeSub.items.data[0].id;

      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: currentItemId, price: process.env.STRIPE_PRICE_MONTHLY }],
        proration_behavior: "none",
        billing_cycle_anchor: "unchanged",
      });
    }

    const updated = await flagDowngrade(doctorId);
    res.json(updated);
  } catch (err) {
    console.error("PATCH /subscriptions/downgrade:", err);
    res.status(500).json({ error: err.message || "Failed to flag downgrade." });
  }
});

module.exports = router;
