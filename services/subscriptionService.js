const { v4: uuidv4 } = require("uuid");
const { getSubscriptionsContainer } = require("./billingCosmosClient");
const { logBillingEvent } = require("./billingAuditService");
require("dotenv").config();

const TRIAL_DAYS = parseInt(process.env.TRIAL_DURATION_DAYS || "30", 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function addYears(date, years) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
}

// ─── Read ─────────────────────────────────────────────────────────────────────

async function getSubscription(doctorId) {
  const container = getSubscriptionsContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.doctorId = @doctorId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@doctorId", value: doctorId }],
    })
    .fetchAll();
  return resources[0] || null;
}

// ─── Create subscription ──────────────────────────────────────────────────────

async function createSubscription(doctorId, modality, stripeCustomerId, stripeSubscriptionId, paymentMethodType) {
  const container = getSubscriptionsContainer();
  const now = new Date().toISOString();

  let currentPeriodEnd;
  if (modality === "monthly") currentPeriodEnd = addMonths(now, 1);
  else if (modality === "annual") currentPeriodEnd = addYears(now, 1);
  else currentPeriodEnd = addMonths(now, 1); // one_time: 1 month

  const doc = {
    id: uuidv4(),
    doctorId,
    modality,
    status: "active",
    trialStartDate: null,
    trialEndDate: null,
    currentPeriodStart: now,
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
    pendingDowngrade: false,
    stripeCustomerId: stripeCustomerId || null,
    stripeSubscriptionId: stripeSubscriptionId || null,
    braintreeCustomerId: null,
    activePaymentMethodType: paymentMethodType || "stripe_card",
    seats: [],
    createdAt: now,
    updatedAt: now,
  };

  const { resource } = await container.items.create(doc);

  await logBillingEvent(doctorId, "subscription_created", doctorId, { modality });

  return resource;
}

// ─── Start free trial ─────────────────────────────────────────────────────────

async function startTrial(doctorId) {
  const existing = await getSubscription(doctorId);
  if (existing) {
    throw new Error("Doctor already has an active subscription or trial.");
  }

  const container = getSubscriptionsContainer();
  const now = new Date().toISOString();
  const trialEndDate = addDays(now, TRIAL_DAYS);

  const doc = {
    id: uuidv4(),
    doctorId,
    modality: null,
    status: "trial",
    trialStartDate: now,
    trialEndDate,
    currentPeriodStart: now,
    currentPeriodEnd: trialEndDate,
    cancelAtPeriodEnd: false,
    pendingDowngrade: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    braintreeCustomerId: null,
    activePaymentMethodType: null,
    seats: [],
    createdAt: now,
    updatedAt: now,
  };

  const { resource } = await container.items.create(doc);

  await logBillingEvent(doctorId, "trial_started", doctorId, { trialEndDate });

  return resource;
}

// ─── Trial status ─────────────────────────────────────────────────────────────

async function getTrialStatus(doctorId) {
  const sub = await getSubscription(doctorId);
  if (!sub || sub.status !== "trial") {
    return { onTrial: false };
  }

  const now = new Date();
  const end = new Date(sub.trialEndDate);
  const daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));

  return {
    onTrial: true,
    trialEndDate: sub.trialEndDate,
    daysLeft,
    expired: daysLeft === 0,
  };
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

async function cancelSubscription(doctorId, immediate = false) {
  const sub = await getSubscription(doctorId);
  if (!sub) throw new Error("No active subscription found.");

  const container = getSubscriptionsContainer();
  const now = new Date().toISOString();

  const updates = {
    ...sub,
    updatedAt: now,
    cancelAtPeriodEnd: !immediate,
    ...(immediate && { status: "cancelled", currentPeriodEnd: now }),
  };

  const { resource } = await container.item(sub.id, sub.doctorId).replace(updates);

  await logBillingEvent(doctorId, "subscription_cancelled", doctorId, { immediate });

  return resource;
}

// ─── Convert one-time → recurring ─────────────────────────────────────────────

async function convertSubscription(doctorId, newModality, stripeSubscriptionId) {
  const sub = await getSubscription(doctorId);
  if (!sub) throw new Error("No subscription found.");
  if (!["one_time", "trial"].includes(sub.modality) && sub.status !== "trial") {
    throw new Error("Only one-time or trial subscriptions can be converted.");
  }

  const container = getSubscriptionsContainer();
  const now = new Date().toISOString();
  const currentPeriodEnd = newModality === "annual" ? addYears(now, 1) : addMonths(now, 1);

  const updates = {
    ...sub,
    modality: newModality,
    status: "active",
    stripeSubscriptionId: stripeSubscriptionId || sub.stripeSubscriptionId,
    currentPeriodStart: now,
    currentPeriodEnd,
    updatedAt: now,
  };

  const { resource } = await container.item(sub.id, sub.doctorId).replace(updates);

  await logBillingEvent(doctorId, "plan_changed", doctorId, {
    from: sub.modality,
    to: newModality,
  });

  return resource;
}

// ─── Downgrade annual → monthly ───────────────────────────────────────────────

async function flagDowngrade(doctorId) {
  const sub = await getSubscription(doctorId);
  if (!sub || sub.modality !== "annual") {
    throw new Error("Only annual subscriptions can be downgraded.");
  }

  const container = getSubscriptionsContainer();
  const updates = { ...sub, pendingDowngrade: true, updatedAt: new Date().toISOString() };
  const { resource } = await container.item(sub.id, sub.doctorId).replace(updates);

  await logBillingEvent(doctorId, "plan_changed", doctorId, { from: "annual", to: "monthly", pending: true });

  return resource;
}

// ─── Update subscription fields (used by webhooks + cron) ─────────────────────

async function updateSubscription(doctorId, fields) {
  const sub = await getSubscription(doctorId);
  if (!sub) throw new Error("No subscription found.");

  const container = getSubscriptionsContainer();
  const updates = { ...sub, ...fields, updatedAt: new Date().toISOString() };
  const { resource } = await container.item(sub.id, sub.doctorId).replace(updates);
  return resource;
}

// ─── Used by cron: fetch subscriptions by status ──────────────────────────────

async function getSubscriptionsByStatus(status) {
  const container = getSubscriptionsContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.status = @status",
      parameters: [{ name: "@status", value: status }],
    })
    .fetchAll();
  return resources;
}

module.exports = {
  getSubscription,
  createSubscription,
  startTrial,
  getTrialStatus,
  cancelSubscription,
  convertSubscription,
  flagDowngrade,
  updateSubscription,
  getSubscriptionsByStatus,
};
