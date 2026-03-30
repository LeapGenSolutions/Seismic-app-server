const express = require("express");
const router = express.Router();
const { authenticateCIAM, requireRegistration } = require("../middleware/ciamAuth");
const { authorizePermission } = require("../middleware/rbacAuth");
const {
  createInvitation,
  getInvitationForRegistration,
  listInvitationsForClinic,
  revokeInvitation,
  normalizeEmail,
} = require("../services/invitationsService");
const { sendInvitationEmail } = require("../services/emailService");

function getInviterName(userData = {}) {
  return (
    userData.doctor_name ||
    [userData.firstName, userData.lastName].filter(Boolean).join(" ") ||
    userData.email ||
    "Seismic Connect admin"
  );
}

router.get(
  "/token/:token",
  authenticateCIAM,
  async (req, res) => {
    try {
      const invitation = await getInvitationForRegistration(
        req.params.token,
        req.user.email
      );

      return res.json({
        token: invitation.token,
        clinicName: invitation.clinicName,
        roleName: invitation.roleName,
        skipNpiValidation: Boolean(invitation.skipNpiValidation),
        invitedEmail: invitation.invitedEmail,
        invitedByName: invitation.invitedByName || invitation.invitedByEmail || "",
      });
    } catch (error) {
      const status =
        error.message === "INVITATION_EMAIL_MISMATCH"
          ? 403
          : error.message === "INVITATION_NOT_FOUND" ||
            error.message === "INVITATION_ALREADY_USED"
          ? 404
          : 500;

      return res.status(status).json({
        error: "Invitation not available",
        message:
          error.message === "INVITATION_EMAIL_MISMATCH"
            ? "This invitation is tied to a different email address."
            : error.message === "INVITATION_ALREADY_USED"
            ? "This invitation has already been used."
            : error.message === "INVITATION_NOT_FOUND"
            ? "This invitation is no longer available."
            : "Failed to load invitation details",
      });
    }
  }
);

router.get(
  "/",
  authenticateCIAM,
  requireRegistration,
  authorizePermission("admin.manage_rbac"),
  async (req, res) => {
    try {
      const invitations = await listInvitationsForClinic(req.userData.clinicName);
      return res.json(invitations);
    } catch (error) {
      console.error("List invitations error:", error);
      return res.status(500).json({
        error: "Internal server error",
        message: "Failed to load invitations",
      });
    }
  }
);

router.post(
  "/",
  authenticateCIAM,
  requireRegistration,
  authorizePermission("admin.manage_rbac"),
  async (req, res) => {
    try {
      const invitedEmail = normalizeEmail(req.body?.email);
      const roleName = String(req.body?.roleName || "").trim();

      if (!invitedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail)) {
        return res.status(400).json({
          error: "Invalid request",
          message: "A valid email is required",
        });
      }

      if (!roleName) {
        return res.status(400).json({
          error: "Invalid request",
          message: "roleName is required",
        });
      }

      const invitation = await createInvitation({
        clinicName: req.userData.clinicName,
        invitedEmail,
        roleName,
        skipNpiValidation: Boolean(req.body?.skipNpiValidation),
        invitedByUserId: req.userData.userId,
        invitedByEmail: req.userData.email,
        invitedByName: getInviterName(req.userData),
      });

      try {
        await sendInvitationEmail(
          invitation.invitedEmail,
          getInviterName(req.userData),
          invitation.clinicName,
          invitation.roleName,
          invitation.token
        );
      } catch (emailError) {
        await revokeInvitation(
          invitation.id,
          invitation.clinicName,
          req.userData.email || req.user.email
        );
        throw emailError;
      }

      return res.status(201).json({
        success: true,
        invitation,
      });
    } catch (error) {
      const status = error.message === "INVITATION_ALREADY_EXISTS" ? 409 : 500;
      return res.status(status).json({
        error: status === 409 ? "Conflict" : "Internal server error",
        message:
          error.message === "INVITATION_ALREADY_EXISTS"
            ? "An active invitation already exists for this email."
            : error.message || "Failed to send invitation",
      });
    }
  }
);

router.delete(
  "/:id",
  authenticateCIAM,
  requireRegistration,
  authorizePermission("admin.manage_rbac"),
  async (req, res) => {
    try {
      await revokeInvitation(
        req.params.id,
        req.userData.clinicName,
        req.userData.email || req.user.email
      );

      return res.json({ success: true });
    } catch (error) {
      const status = error.message === "INVITATION_NOT_FOUND" ? 404 : 500;
      return res.status(status).json({
        error: status === 404 ? "Not found" : "Internal server error",
        message:
          error.message === "INVITATION_NOT_FOUND"
            ? "Invitation was not found."
            : "Failed to revoke invitation",
      });
    }
  }
);

module.exports = router;
