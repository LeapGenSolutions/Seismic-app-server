const { getSubscriptionsContainer } = require("./billingCosmosClient");
const { logBillingEvent } = require("./billingAuditService");
const { getSubscription } = require("./subscriptionService");
require("dotenv").config();

const MAX_SEATS = 2;

const SEAT_PRICES = {
  "Nurse Practitioner": parseFloat(process.env.SEAT_NP_PRICE_MONTHLY || "29"),
  "Back Office Staff": parseFloat(process.env.SEAT_BACKOFFICE_PRICE_MONTHLY || "19"),
};

function calcProration(monthlyPrice, periodEnd) {
  const now = new Date();
  const end = new Date(periodEnd);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  return parseFloat(((monthlyPrice / daysInMonth) * daysRemaining).toFixed(2));
}

async function listSeats(doctorId) {
  const sub = await getSubscription(doctorId);
  return sub?.seats || [];
}

async function getCostPreview(doctorId, role) {
  if (!SEAT_PRICES[role]) throw new Error(`Unknown role: ${role}`);

  const sub = await getSubscription(doctorId);
  if (!sub) throw new Error("No active subscription found.");

  const monthlyPrice = SEAT_PRICES[role];
  const proratedAmount = calcProration(monthlyPrice, sub.currentPeriodEnd);

  return {
    role,
    monthlyPrice,
    proratedAmount,
    periodEnd: sub.currentPeriodEnd,
  };
}

async function addSeat(doctorId, userId, role) {
  if (!SEAT_PRICES[role]) throw new Error(`Unknown role: ${role}`);

  const sub = await getSubscription(doctorId);
  if (!sub || !["active", "trial"].includes(sub.status)) {
    throw new Error("No active subscription.");
  }

  if (sub.seats.length >= MAX_SEATS) {
    const err = new Error("Seat limit reached.");
    err.upgradeRequired = true;
    err.redirectUrl = process.env.CLINIC_PLAN_REDIRECT_URL;
    throw err;
  }

  // Check if user is already a seat
  if (sub.seats.some((s) => s.userId === userId)) {
    throw new Error("User is already a seat on this subscription.");
  }

  const monthlyPrice = SEAT_PRICES[role];
  const proratedAmount = calcProration(monthlyPrice, sub.currentPeriodEnd);

  const newSeat = {
    userId,
    role,
    addedAt: new Date().toISOString(),
    monthlyPrice,
    proratedAmount,
  };

  const container = getSubscriptionsContainer();
  const updatedSeats = [...sub.seats, newSeat];
  const updates = { ...sub, seats: updatedSeats, updatedAt: new Date().toISOString() };
  const { resource } = await container.item(sub.id, sub.doctorId).replace(updates);

  await logBillingEvent(doctorId, "seat_added", doctorId, { userId, role, proratedAmount });

  return { seat: newSeat, subscription: resource, proratedAmount };
}

async function removeSeat(doctorId, userId) {
  const sub = await getSubscription(doctorId);
  if (!sub) throw new Error("No active subscription.");

  const seat = sub.seats.find((s) => s.userId === userId);
  if (!seat) throw new Error("Seat not found.");

  const monthlyPrice = SEAT_PRICES[seat.role];
  const creditAmount = calcProration(monthlyPrice, sub.currentPeriodEnd);

  const container = getSubscriptionsContainer();
  const updatedSeats = sub.seats.filter((s) => s.userId !== userId);
  const updates = { ...sub, seats: updatedSeats, updatedAt: new Date().toISOString() };
  const { resource } = await container.item(sub.id, sub.doctorId).replace(updates);

  await logBillingEvent(doctorId, "seat_removed", doctorId, { userId, role: seat.role, creditAmount });

  return { removed: seat, subscription: resource, creditAmount };
}

module.exports = { listSeats, getCostPreview, addSeat, removeSeat };
