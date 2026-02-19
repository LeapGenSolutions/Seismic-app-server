let appInsights;
let telemetryClient = null;
let initialized = false;

try {
  appInsights = require("applicationinsights");
} catch (error) {
  appInsights = null;
}

function initTelemetry() {
  if (initialized) {
    return telemetryClient;
  }
  initialized = true;

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  if (!connectionString || !appInsights) {
    if (connectionString && !appInsights) {
      console.warn("APPLICATIONINSIGHTS_CONNECTION_STRING is set but 'applicationinsights' package is not installed.");
    }
    return null;
  }

  appInsights
    .setup(connectionString)
    .setAutoCollectRequests(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectPerformance(true)
    .setSendLiveMetrics(false)
    .start();

  telemetryClient = appInsights.defaultClient;
  return telemetryClient;
}

function asTelemetryProps(properties = {}) {
  const out = {};
  Object.entries(properties).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === "string") {
      out[key] = value;
      return;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value);
      return;
    }
    out[key] = JSON.stringify(value);
  });
  return out;
}

function trackAppointmentAudit(eventName, properties = {}) {
  const client = telemetryClient || initTelemetry();
  if (!client) {
    return;
  }

  client.trackEvent({
    name: eventName || "appointment.audit",
    properties: asTelemetryProps({
      logged_at: new Date().toISOString(),
      ...properties
    })
  });
}

module.exports = {
  initTelemetry,
  trackAppointmentAudit
};
