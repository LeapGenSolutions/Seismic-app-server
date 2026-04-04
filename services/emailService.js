const sgMail = require("@sendgrid/mail");
require("dotenv").config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM = process.env.SENDGRID_FROM_EMAIL || "billing@seismichealth.com";

async function send(to, subject, html, attachments = []) {
  const msg = { to, from: FROM, subject, html };
  if (attachments.length) msg.attachments = attachments;
  try {
    await sgMail.send(msg);
  } catch (err) {
    console.error(`Email send failed [${subject}]:`, err.response?.body || err.message);
  }
}

// ─── Payment ──────────────────────────────────────────────────────────────────

async function sendPaymentSuccess(doctorEmail, invoicePdfBuffer, invoiceNumber) {
  const attachments = invoicePdfBuffer
    ? [{
        content: invoicePdfBuffer.toString("base64"),
        filename: `${invoiceNumber}.pdf`,
        type: "application/pdf",
        disposition: "attachment",
      }]
    : [];

  await send(
    doctorEmail,
    "Payment Confirmed — SEISMIC",
    `<h2>Payment Confirmed</h2>
     <p>Thank you! Your payment has been processed successfully.</p>
     <p>Please find your invoice attached.</p>
     <p>— The SEISMIC Team</p>`,
    attachments
  );
}

async function sendPaymentFailed(doctorEmail) {
  await send(
    doctorEmail,
    "Payment Failed — Action Required",
    `<h2>Payment Failed</h2>
     <p>We were unable to process your payment. Please update your payment method in the billing settings.</p>
     <p>Your subscription will remain active during a short grace period.</p>
     <p>— The SEISMIC Team</p>`
  );
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

async function sendInvoiceEmail(doctorEmail, invoicePdfBuffer, invoiceNumber) {
  await send(
    doctorEmail,
    `Your SEISMIC Invoice ${invoiceNumber}`,
    `<h2>Invoice Ready</h2>
     <p>Your invoice <strong>${invoiceNumber}</strong> is attached to this email.</p>
     <p>— The SEISMIC Team</p>`,
    [{
      content: invoicePdfBuffer.toString("base64"),
      filename: `${invoiceNumber}.pdf`,
      type: "application/pdf",
      disposition: "attachment",
    }]
  );
}

// ─── One-time subscription expiry reminders ───────────────────────────────────

async function sendExpiryReminder(doctorEmail, daysLeft, expiryDate) {
  await send(
    doctorEmail,
    `Your SEISMIC subscription expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
    `<h2>Subscription Expiring Soon</h2>
     <p>Your one-time subscription expires on <strong>${new Date(expiryDate).toLocaleDateString()}</strong> (${daysLeft} day${daysLeft !== 1 ? "s" : ""} left).</p>
     <p>To continue using SEISMIC, please extend your subscription or upgrade to a monthly or annual plan in your billing settings.</p>
     <p>— The SEISMIC Team</p>`
  );
}

async function sendExpiryNotice(doctorEmail) {
  await send(
    doctorEmail,
    "Your SEISMIC subscription has expired",
    `<h2>Subscription Expired</h2>
     <p>Your SEISMIC subscription has expired. Access to premium features has been restricted.</p>
     <p>Please visit your billing settings to renew or upgrade your plan.</p>
     <p>— The SEISMIC Team</p>`
  );
}

// ─── Annual renewal reminder ──────────────────────────────────────────────────

async function sendAnnualRenewalReminder(doctorEmail, renewalDate) {
  await send(
    doctorEmail,
    "Your SEISMIC annual subscription renews in 30 days",
    `<h2>Annual Renewal Reminder</h2>
     <p>Your annual subscription will auto-renew on <strong>${new Date(renewalDate).toLocaleDateString()}</strong>.</p>
     <p>If you'd like to change your plan or cancel, visit your billing settings before the renewal date.</p>
     <p>— The SEISMIC Team</p>`
  );
}

// ─── Monthly renewal reminder ─────────────────────────────────────────────────

async function sendMonthlyRenewalReminder(doctorEmail, renewalDate) {
  await send(
    doctorEmail,
    "Your SEISMIC subscription renews in 3 days",
    `<h2>Renewal Reminder</h2>
     <p>Your monthly subscription will auto-renew on <strong>${new Date(renewalDate).toLocaleDateString()}</strong>.</p>
     <p>— The SEISMIC Team</p>`
  );
}

// ─── Seat notifications ───────────────────────────────────────────────────────

async function sendSeatAdded(doctorEmail, role, userId) {
  await send(
    doctorEmail,
    "Supporting user added — SEISMIC billing updated",
    `<h2>Seat Added</h2>
     <p>A <strong>${role}</strong> seat for <strong>${userId}</strong> has been added to your subscription.</p>
     <p>Your billing has been updated accordingly.</p>
     <p>— The SEISMIC Team</p>`
  );
}

async function sendSeatRemoved(doctorEmail, role, userId) {
  await send(
    doctorEmail,
    "Supporting user removed — SEISMIC billing updated",
    `<h2>Seat Removed</h2>
     <p>The <strong>${role}</strong> seat for <strong>${userId}</strong> has been removed from your subscription.</p>
     <p>A prorated credit has been applied to your account.</p>
     <p>— The SEISMIC Team</p>`
  );
}

// ─── Trial ────────────────────────────────────────────────────────────────────

async function sendTrialStarted(doctorEmail, trialEndDate) {
  await send(
    doctorEmail,
    "Your 30-day SEISMIC free trial has started",
    `<h2>Welcome to SEISMIC!</h2>
     <p>Your free trial is active until <strong>${new Date(trialEndDate).toLocaleDateString()}</strong>.</p>
     <p>Enjoy full access to all features during your trial period.</p>
     <p>— The SEISMIC Team</p>`
  );
}

async function sendTrialReminder(doctorEmail, daysLeft, trialEndDate) {
  await send(
    doctorEmail,
    `Your SEISMIC trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
    `<h2>Trial Ending Soon</h2>
     <p>Your free trial expires on <strong>${new Date(trialEndDate).toLocaleDateString()}</strong> (${daysLeft} day${daysLeft !== 1 ? "s" : ""} left).</p>
     <p>Add a payment method and choose a plan in your billing settings to keep access.</p>
     <p>— The SEISMIC Team</p>`
  );
}

async function sendTrialExpired(doctorEmail) {
  await send(
    doctorEmail,
    "Your SEISMIC trial has expired — choose a plan to continue",
    `<h2>Trial Expired</h2>
     <p>Your free trial has ended. To continue using SEISMIC, please select a subscription plan.</p>
     <p>Visit your billing settings to get started.</p>
     <p>— The SEISMIC Team</p>`
  );
}

module.exports = {
  sendPaymentSuccess,
  sendPaymentFailed,
  sendInvoiceEmail,
  sendExpiryReminder,
  sendExpiryNotice,
  sendAnnualRenewalReminder,
  sendMonthlyRenewalReminder,
  sendSeatAdded,
  sendSeatRemoved,
  sendTrialStarted,
  sendTrialReminder,
  sendTrialExpired,
};
