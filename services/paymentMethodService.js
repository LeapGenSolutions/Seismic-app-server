const { v4: uuidv4 } = require("uuid");
const { getPaymentMethodsContainer } = require("./billingCosmosClient");
const { logBillingEvent } = require("./billingAuditService");
require("dotenv").config();

async function listPaymentMethods(doctorId) {
  const container = getPaymentMethodsContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.doctorId = @doctorId ORDER BY c.createdAt DESC",
      parameters: [{ name: "@doctorId", value: doctorId }],
    })
    .fetchAll();
  return resources;
}

async function saveStripeCard(doctorId, stripeCustomerId, stripePaymentMethod) {
  const container = getPaymentMethodsContainer();

  // Check if already saved
  const { resources: existing } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.doctorId = @doctorId AND c.stripePaymentMethodId = @pmId",
      parameters: [
        { name: "@doctorId", value: doctorId },
        { name: "@pmId", value: stripePaymentMethod.id },
      ],
    })
    .fetchAll();

  if (existing.length) return existing[0];

  const doc = {
    id: uuidv4(),
    doctorId,
    type: "stripe_card",
    stripeCustomerId,
    stripePaymentMethodId: stripePaymentMethod.id,
    last4: stripePaymentMethod.card.last4,
    brand: stripePaymentMethod.card.brand,
    expMonth: stripePaymentMethod.card.exp_month,
    expYear: stripePaymentMethod.card.exp_year,
    venmoEmail: null,
    braintreePaymentMethodToken: null,
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  const { resource } = await container.items.create(doc);
  return resource;
}

async function saveVenmoMethod(doctorId, braintreeCustomerId, braintreeToken, venmoEmail) {
  const container = getPaymentMethodsContainer();

  const doc = {
    id: uuidv4(),
    doctorId,
    type: "venmo",
    stripeCustomerId: null,
    stripePaymentMethodId: null,
    last4: null,
    brand: null,
    expMonth: null,
    expYear: null,
    venmoEmail: venmoEmail || null,
    braintreeCustomerId,
    braintreePaymentMethodToken: braintreeToken,
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  const { resource } = await container.items.create(doc);

  await logBillingEvent(doctorId, "payment_method_added", doctorId, { type: "venmo" });

  return resource;
}

async function removePaymentMethod(doctorId, pmId) {
  const container = getPaymentMethodsContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.doctorId = @doctorId AND c.id = @id",
      parameters: [
        { name: "@doctorId", value: doctorId },
        { name: "@id", value: pmId },
      ],
    })
    .fetchAll();

  if (!resources.length) throw new Error("Payment method not found.");

  const pm = resources[0];
  await container.item(pm.id, pm.doctorId).delete();

  await logBillingEvent(doctorId, "payment_method_removed", doctorId, { type: pm.type });
}

async function setDefaultPaymentMethod(doctorId, pmId) {
  const container = getPaymentMethodsContainer();
  const { resources: all } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.doctorId = @doctorId",
      parameters: [{ name: "@doctorId", value: doctorId }],
    })
    .fetchAll();

  const target = all.find((pm) => pm.id === pmId);
  if (!target) throw new Error("Payment method not found.");

  for (const pm of all) {
    const updated = { ...pm, isDefault: pm.id === pmId };
    await container.item(pm.id, pm.doctorId).replace(updated);
  }
}

module.exports = {
  listPaymentMethods,
  saveStripeCard,
  saveVenmoMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
};
