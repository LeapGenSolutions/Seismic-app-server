const { v4: uuidv4 } = require("uuid");
const { getBillingAuditLogsContainer } = require("./billingCosmosClient");
const { trackAppointmentAudit } = require("./telemetryService");

async function logBillingEvent(doctorId, eventType, performedBy, metadata = {}) {
  const log = {
    id: uuidv4(),
    doctorId,
    eventType,
    performedBy,
    metadata,
    createdAt: new Date().toISOString(),
  };

  try {
    const container = getBillingAuditLogsContainer();
    await container.items.create(log);
  } catch (err) {
    console.error("Failed to write billing audit log:", err.message);
  }

  try {
    trackAppointmentAudit(eventType, { doctorId, performedBy, ...metadata });
  } catch (err) {
    console.error("Failed to track billing telemetry:", err.message);
  }
}

module.exports = { logBillingEvent };
