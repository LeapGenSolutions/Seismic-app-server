function getEnv(name, fallback = "") {
  const value = process.env[name];
  return value === undefined ? fallback : String(value).trim();
}

function getInvitationBaseUrl() {
  return getEnv(
    "INVITATION_BASE_URL",
    "http://localhost:3001/standalone/registration"
  ).replace(/\/+$/, "");
}

function buildInvitationUrl(token) {
  return `${getInvitationBaseUrl()}?invitation=${encodeURIComponent(token)}`;
}

function getTransportConfig() {
  return {
    host: getEnv("SMTP_HOST", "smtp.office365.com"),
    port: Number(getEnv("SMTP_PORT", "587")),
    secure: getEnv("SMTP_SECURE", "false").toLowerCase() === "true",
    auth: {
      user: getEnv("SMTP_USER"),
      pass: getEnv("SMTP_PASS"),
    },
  };
}

function ensureEmailConfigured() {
  const requiredKeys = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"];
  const missingKeys = requiredKeys.filter((key) => !getEnv(key));

  if (missingKeys.length > 0) {
    throw new Error(
      `SMTP configuration is incomplete. Missing: ${missingKeys.join(", ")}`
    );
  }
}

function getTransporter() {
  ensureEmailConfigured();

  let nodemailer;
  try {
    nodemailer = require("nodemailer");
  } catch (error) {
    throw new Error(
      "Email support is unavailable because nodemailer is not installed. Run npm install in Seismic-app-server."
    );
  }

  return nodemailer.createTransport(getTransportConfig());
}

async function sendInvitationEmail(
  recipientEmail,
  inviterName,
  clinicName,
  roleName,
  invitationToken
) {
  const transporter = getTransporter();
  const invitationUrl = buildInvitationUrl(invitationToken);
  const sender = getEnv("SMTP_FROM");
  const safeInviterName = inviterName || "A Seismic Connect administrator";

  await transporter.sendMail({
    from: sender,
    to: recipientEmail,
    subject: `You're invited to join ${clinicName} on Seismic Connect`,
    text: [
      `${safeInviterName} invited you to join ${clinicName} on Seismic Connect.`,
      roleName ? `Role: ${roleName}` : "",
      "",
      "Complete your registration here:",
      invitationUrl,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>${safeInviterName} invited you to join <strong>${clinicName}</strong> on Seismic Connect.</p>
        ${roleName ? `<p><strong>Role:</strong> ${roleName}</p>` : ""}
        <p>
          <a
            href="${invitationUrl}"
            style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px;"
          >
            Complete Registration
          </a>
        </p>
        <p>If the button does not open, use this link:</p>
        <p><a href="${invitationUrl}">${invitationUrl}</a></p>
      </div>
    `,
  });

  return { invitationUrl };
}

module.exports = {
  buildInvitationUrl,
  sendInvitationEmail,
};
