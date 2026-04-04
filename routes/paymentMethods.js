const express = require("express");
const router = express.Router();
const billingAccess = require("../middleware/billingAccess");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const braintree = require("braintree");
const {
  listPaymentMethods,
  saveStripeCard,
  saveVenmoMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
} = require("../services/paymentMethodService");
const { logBillingEvent } = require("../services/billingAuditService");
const { getSubscription } = require("../services/subscriptionService");

const gateway = new braintree.BraintreeGateway({
  environment: braintree.Environment[
    process.env.BRAINTREE_ENVIRONMENT === "production" ? "Production" : "Sandbox"
  ],
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.BRAINTREE_PRIVATE_KEY,
});

// ─── GET /api/payment-methods ─────────────────────────────────────────────────
router.get("/", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const methods = await listPaymentMethods(doctorId);
    res.json(methods);
  } catch (err) {
    console.error("GET /payment-methods:", err);
    res.status(500).json({ error: "Failed to list payment methods." });
  }
});

// ─── POST /api/payment-methods/setup-intent ───────────────────────────────────
// Creates a Stripe SetupIntent. Frontend uses the returned client_secret
// with Stripe.js to collect and confirm the card — raw card never hits our server.
router.post("/setup-intent", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { firstName, lastName, email } = req.userData;

    // Get or create Stripe customer
    let stripeCustomerId;
    const sub = await getSubscription(doctorId);
    if (sub?.stripeCustomerId) {
      stripeCustomerId = sub.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: email || doctorId,
        name: `${firstName || ""} ${lastName || ""}`.trim(),
        metadata: { doctorId },
      });
      stripeCustomerId = customer.id;
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      metadata: { doctorId },
    });

    res.json({
      clientSecret: setupIntent.client_secret,
      stripeCustomerId,
    });
  } catch (err) {
    console.error("POST /payment-methods/setup-intent:", err);
    res.status(500).json({ error: "Failed to create setup intent." });
  }
});

// ─── POST /api/payment-methods/confirm-card ───────────────────────────────────
// After frontend confirms SetupIntent with Stripe.js, call this to persist
// the card to SEISMIC's database.
// Body: { paymentMethodId: "pm_xxx", stripeCustomerId: "cus_xxx" }
router.post("/confirm-card", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { paymentMethodId, stripeCustomerId } = req.body;

    if (!paymentMethodId || !stripeCustomerId) {
      return res.status(400).json({ error: "paymentMethodId and stripeCustomerId are required." });
    }

    // Retrieve full card details from Stripe
    const stripePaymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);

    // Attach to customer if not already attached
    if (!stripePaymentMethod.customer) {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
    }

    const saved = await saveStripeCard(doctorId, stripeCustomerId, stripePaymentMethod);

    await logBillingEvent(doctorId, "payment_method_added", doctorId, {
      type: "stripe_card",
      last4: stripePaymentMethod.card.last4,
      brand: stripePaymentMethod.card.brand,
    });

    res.status(201).json(saved);
  } catch (err) {
    console.error("POST /payment-methods/confirm-card:", err);
    res.status(500).json({ error: "Failed to save card." });
  }
});

// ─── GET /api/payment-methods/braintree-token ────────────────────────────────
// Returns a Braintree client token for the frontend Venmo drop-in UI.
router.get("/braintree-token", billingAccess, async (req, res) => {
  try {
    const response = await gateway.clientToken.generate({});
    res.json({ clientToken: response.clientToken });
  } catch (err) {
    console.error("GET /payment-methods/braintree-token:", err);
    res.status(500).json({ error: "Failed to generate Braintree client token." });
  }
});

// ─── POST /api/payment-methods/venmo ─────────────────────────────────────────
// Body: { paymentMethodNonce: "xxx", venmoEmail: "user@venmo.com" }
router.post("/venmo", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { paymentMethodNonce, venmoEmail } = req.body;

    if (!paymentMethodNonce) {
      return res.status(400).json({ error: "paymentMethodNonce is required." });
    }

    // Create Braintree customer if needed
    let braintreeCustomerId;
    const sub = await getSubscription(doctorId);
    if (sub?.braintreeCustomerId) {
      braintreeCustomerId = sub.braintreeCustomerId;
    } else {
      const customerResult = await gateway.customer.create({
        email: req.userData.email,
        firstName: req.userData.firstName,
        lastName: req.userData.lastName,
      });
      if (!customerResult.success) {
        throw new Error("Failed to create Braintree customer.");
      }
      braintreeCustomerId = customerResult.customer.id;
    }

    // Vault the Venmo payment method
    const result = await gateway.paymentMethod.create({
      customerId: braintreeCustomerId,
      paymentMethodNonce,
    });

    if (!result.success) {
      throw new Error("Failed to vault Venmo payment method.");
    }

    const token = result.paymentMethod.token;
    const saved = await saveVenmoMethod(doctorId, braintreeCustomerId, token, venmoEmail);

    res.status(201).json(saved);
  } catch (err) {
    console.error("POST /payment-methods/venmo:", err);
    res.status(500).json({ error: err.message || "Failed to link Venmo." });
  }
});

// ─── DELETE /api/payment-methods/:id ─────────────────────────────────────────
router.delete("/:id", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { id } = req.params;

    // If it's a Stripe card, detach from Stripe
    const methods = await listPaymentMethods(doctorId);
    const pm = methods.find((m) => m.id === id);
    if (!pm) return res.status(404).json({ error: "Payment method not found." });

    if (pm.type === "stripe_card" && pm.stripePaymentMethodId) {
      await stripe.paymentMethods.detach(pm.stripePaymentMethodId);
    }

    await removePaymentMethod(doctorId, id);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /payment-methods/:id:", err);
    res.status(500).json({ error: err.message || "Failed to remove payment method." });
  }
});

// ─── PATCH /api/payment-methods/:id/default ──────────────────────────────────
router.patch("/:id/default", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { id } = req.params;
    await setDefaultPaymentMethod(doctorId, id);
    res.json({ success: true });
  } catch (err) {
    console.error("PATCH /payment-methods/:id/default:", err);
    res.status(500).json({ error: err.message || "Failed to set default." });
  }
});

module.exports = router;
