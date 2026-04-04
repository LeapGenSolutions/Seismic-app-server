const express = require("express");
const router = express.Router();
const billingAccess = require("../middleware/billingAccess");
const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { listSeats, getCostPreview, addSeat, removeSeat } = require("../services/seatService");
const { getSubscription } = require("../services/subscriptionService");
require("dotenv").config();

// ─── GET /api/seats ───────────────────────────────────────────────────────────
router.get("/", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const seats = await listSeats(doctorId);
    res.json(seats);
  } catch (err) {
    console.error("GET /seats:", err);
    res.status(500).json({ error: "Failed to list seats." });
  }
});

// ─── GET /api/seats/cost-preview?role=Nurse+Practitioner ────────────────────
router.get("/cost-preview", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { role } = req.query;
    if (!role) return res.status(400).json({ error: "role query param required." });

    const preview = await getCostPreview(doctorId, role);
    res.json(preview);
  } catch (err) {
    console.error("GET /seats/cost-preview:", err);
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/seats ──────────────────────────────────────────────────────────
// Body: { userId: "np@example.com", role: "Nurse Practitioner"|"Back Office Staff" }
router.post("/", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { userId, role } = req.body;

    if (!userId || !role) {
      return res.status(400).json({ error: "userId and role are required." });
    }

    const result = await addSeat(doctorId, userId, role).catch((err) => {
      if (err.upgradeRequired) {
        res.status(403).json({
          error: err.message,
          upgradeRequired: true,
          redirectUrl: err.redirectUrl,
        });
        return null;
      }
      throw err;
    });

    if (!result) return; // response already sent (upgrade prompt)

    // Charge prorated amount via Stripe if card on file
    const sub = await getSubscription(doctorId);
    if (sub?.stripeCustomerId && result.proratedAmount > 0) {
      try {
        const priceId = role === "Nurse Practitioner"
          ? process.env.STRIPE_PRICE_SEAT_NP
          : process.env.STRIPE_PRICE_SEAT_BACKOFFICE;

        await stripe.invoiceItems.create({
          customer: sub.stripeCustomerId,
          amount: Math.round(result.proratedAmount * 100),
          currency: "usd",
          description: `Prorated ${role} seat — added ${new Date().toLocaleDateString()}`,
          subscription: sub.stripeSubscriptionId || undefined,
        });

        // Immediately charge if there's no upcoming invoice to attach to
        if (!sub.stripeSubscriptionId) {
          const invoice = await stripe.invoices.create({
            customer: sub.stripeCustomerId,
            auto_advance: true,
          });
          await stripe.invoices.finalizeInvoice(invoice.id);
          await stripe.invoices.pay(invoice.id);
        }
      } catch (stripeErr) {
        console.error("Stripe seat proration charge failed:", stripeErr.message);
        // Don't fail the seat addition — log and continue
      }
    }

    res.status(201).json(result);
  } catch (err) {
    console.error("POST /seats:", err);
    res.status(500).json({ error: err.message || "Failed to add seat." });
  }
});

// ─── DELETE /api/seats/:userId ────────────────────────────────────────────────
router.delete("/:userId", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { userId } = req.params;

    const result = await removeSeat(doctorId, userId);

    // Apply Stripe credit if card on file
    const sub = await getSubscription(doctorId);
    if (sub?.stripeCustomerId && result.creditAmount > 0) {
      try {
        await stripe.customers.createBalanceTransaction(sub.stripeCustomerId, {
          amount: -Math.round(result.creditAmount * 100), // negative = credit
          currency: "usd",
          description: `Credit for removed ${result.removed.role} seat`,
        });
      } catch (stripeErr) {
        console.error("Stripe credit failed:", stripeErr.message);
      }
    }

    res.json(result);
  } catch (err) {
    console.error("DELETE /seats/:userId:", err);
    res.status(500).json({ error: err.message || "Failed to remove seat." });
  }
});

module.exports = router;
