const express = require("express");
const router = express.Router();
const {
  verifyStandaloneAuth,
  registerStandaloneUser,
  signCurrentBaaForUser,
  getRoleRegistrationConfig,
  normalizeRoleName,
} = require("../services/standaloneService");
const { getInvitationForRegistration } = require("../services/invitationsService");
const { verifyIdToken, generateJWT, extractUserInfo } = require("../services/tokenVerification");
const { authenticateCIAM, requireRegistration } = require("../middleware/ciamAuth");

const CURRENT_BAA_VERSION = process.env.CURRENT_BAA_VERSION || "v1.0";



router.post("/auth/verify", async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["idToken"]
      });
    }

    // Verify ID token from CIAM
    let tokenPayload;
    try {
      tokenPayload = await verifyIdToken(idToken);
    } catch (err) {
      console.error('ID token verification failed:', err.message);
      return res.status(401).json({
        error: "Invalid or expired ID token",
        message: err.message
      });
    }

    // Extract user info from token
    let userInfo;
    try {
      userInfo = extractUserInfo(tokenPayload);
    } catch (err) {
      console.error('Token claims validation failed:', err.message);
      return res.status(403).json({
        error: "Token claims do not match provided credentials",
        message: err.message
      });
    }

    // Verify/create user in database
    const result = await verifyStandaloneAuth(userInfo.email, userInfo.userId);

    // Generate our own JWT token (only userId and email needed)
    const jwtToken = generateJWT({
      userId: result.userId,
      email: result.email
    });

    res.json({
      ...result,
      token: jwtToken // Return our JWT token to frontend
    });

  } catch (error) {
    console.error("CIAM auth verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});



router.post("/register", authenticateCIAM, async (req, res) => {
  try {
    const data = req.body;
    let invitation = null;
    if (data.invitationToken) {
      const registrationEmail = data.primaryEmail || req.user.email;
      invitation = await getInvitationForRegistration(
        data.invitationToken,
        registrationEmail
      );
      data.clinicName = invitation.clinicName;
      data.role = invitation.roleName;
    }

    const normalizedRole = normalizeRoleName(data.role);
    data.role = normalizedRole;
    let roleConfig = invitation
      ? {
          roleName: invitation.roleName,
          type: "invited",
          skipNpiValidation: Boolean(invitation.skipNpiValidation),
        }
      : await getRoleRegistrationConfig(
          normalizedRole,
          data.clinicName
        );

    if (!roleConfig) {
      return res.status(400).json({
        error: "Invalid role",
        message: "The selected role is not available for this clinic",
      });
    }

    const shouldValidateNpi = !roleConfig.skipNpiValidation;

    // Use userId from verified token
    data.userId = req.user.userId;

    // Validate required fields
    const required = [
      'firstName',
      'lastName',
      'primaryEmail',
      'role',
      'specialty',
      'statesOfLicense',
      'termsAccepted',
      'privacyAccepted',
      'clinicalResponsibilityAccepted',
      'baaAccepted',
      'baaVersion',
      'baaSignedAt',
      'baaSignerName'
    ];

    if (shouldValidateNpi) {
      required.push("npiNumber");
    }

    const missing = required.filter(field => !data[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        fields: missing
      });
    }

    // Validate NPI format (exactly 10 digits)
    if (shouldValidateNpi && !/^\d{10}$/.test(data.npiNumber)) {
      return res.status(400).json({
        error: "Invalid NPI number",
        message: "NPI must be exactly 10 digits"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.primaryEmail)) {
      return res.status(400).json({
        error: "Invalid email format"
      });
    }

    if (invitation && data.primaryEmail.trim().toLowerCase() !== invitation.invitedEmail) {
      return res.status(403).json({
        error: "Invitation email mismatch",
        message: "This invitation must be completed with the invited email address.",
      });
    }

    // Validate legal agreements are true
    if (!data.termsAccepted || !data.privacyAccepted || !data.clinicalResponsibilityAccepted) {
      return res.status(400).json({
        error: "All legal agreements must be accepted"
      });
    }

    if (
      data.baaAccepted !== true ||
      data.baaVersion !== CURRENT_BAA_VERSION ||
      !data.baaSignedAt ||
      !data.baaSignerName ||
      String(data.baaSignerName).trim().length < 2
    ) {
      return res.status(400).json({
        error: "BAA signature required",
        message: `The current BAA version (${CURRENT_BAA_VERSION}) must be reviewed and signed before registration.`
      });
    }

    // Validate states of license (at least 1)
    if (!Array.isArray(data.statesOfLicense) || data.statesOfLicense.length === 0) {
      return res.status(400).json({
        error: "At least one state of license is required"
      });
    }

    // Register user
    const user = await registerStandaloneUser(data);

    res.status(201).json(user);

  } catch (error) {
    console.error("Registration error:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        error: "User not found",
        message: "Please login again"
      });
    }

    if (error.message === "NPI_DUPLICATE") {
      return res.status(409).json({
        error: "NPI already registered",
        message: "An account with this NPI number already exists"
      });
    }

    if (
      error.message === "INVITATION_NOT_FOUND" ||
      error.message === "INVITATION_ALREADY_USED"
    ) {
      return res.status(404).json({
        error: "Invitation unavailable",
        message: "This invitation is no longer available.",
      });
    }

    if (error.message === "INVITATION_EMAIL_MISMATCH") {
      return res.status(403).json({
        error: "Invitation email mismatch",
        message: "This invitation must be completed with the invited email address.",
      });
    }

    res.status(500).json({ error: "Internal server error" });
  }
});


router.get("/profile", authenticateCIAM, async (req, res) => {
  try {
    const { getUsersContainer } = require("../services/cosmosClient");
    const container = getUsersContainer();

    // Cross-partition query by userId
    const querySpec = {
      query: "SELECT * FROM c WHERE c.userId = @userId",
      parameters: [{ name: "@userId", value: req.user.userId }]
    };

    const { resources } = await container.items.query(querySpec).fetchAll();

    if (resources.length === 0) {
      return res.status(404).json({
        error: "User not found",
        message: "Please complete registration"
      });
    }

    const user = resources[0];

    // Remove Cosmos DB internal fields
    delete user._rid;
    delete user._self;
    delete user._etag;
    delete user._attachments;
    delete user._ts;
    delete user.baaSignatureHistory;

    res.json(user);

  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/profile/preferences", authenticateCIAM, async (req, res) => {
  try {
    const { getUsersContainer } = require("../services/cosmosClient");
    const container = getUsersContainer();
    const updates = req.body; // e.g., { notifications: { email: true, sms: false }, timeZone: "PST" }

    // Fetch user first to get their Cosmos item id
    const querySpec = {
      query: "SELECT * FROM c WHERE c.id = @userId OR c.doctor_id = @userId OR c.doctor_email = @userId",
      parameters: [{ name: "@userId", value: req.user.userId }]
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    if (resources.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = resources[0];

    // Merge updates safely
    const updatedUser = {
      ...user,
      notifications: updates.notifications ? { ...(user.notifications || {}), ...updates.notifications } : user.notifications,
      timeZone: updates.timeZone || user.timeZone,
      updatedAt: new Date().toISOString()
    };
    delete updatedUser.baaSignatureHistory;

    const { resource } = await container.item(user.id, user.id).replace(updatedUser);
    delete resource.baaSignatureHistory;

    res.json({ success: true, user: resource });
  } catch (error) {
    console.error("Profile preferences update error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/baa/status", authenticateCIAM, requireRegistration, async (req, res) => {
  try {
    const user = req.userData;
    const signedCurrentVersion = user.baaAccepted === true;

    return res.json({
      signed: signedCurrentVersion,
      accepted: user.baaAccepted === true,
      requiredVersion: CURRENT_BAA_VERSION,
      signedVersion: user.baaVersion || null,
      signedAt: user.baaSignedAt || null,
      signerName: user.baaSignerName || null,
      agreementUrl: user.baaAgreementUrl || null,
      agreementBlobName: user.baaAgreementBlobName || null,
      agreementContainer: user.baaAgreementContainer || null,
      signatureCertificateUrl: user.baaSignatureCertificateUrl || null,
      signatureCertificateBlobName: user.baaSignatureCertificateBlobName || null,
      signatureCertificateContainer: user.baaSignatureCertificateContainer || null,
    });
  } catch (error) {
    console.error("BAA status error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to load BAA status",
    });
  }
});

router.post("/baa/sign", authenticateCIAM, requireRegistration, async (req, res) => {
  try {
    const data = req.body || {};
    const signerName = String(data.baaSignerName || data.signerName || "").trim();

    if (
      data.baaVersion !== CURRENT_BAA_VERSION ||
      !signerName ||
      signerName.length < 2
    ) {
      return res.status(400).json({
        error: "BAA signature required",
        message: `The current BAA version (${CURRENT_BAA_VERSION}) must be reviewed and signed.`,
      });
    }

    const user = await signCurrentBaaForUser(req.userData, {
      ...data,
      baaSignerName: signerName,
      baaSignedAt: data.baaSignedAt || new Date().toISOString(),
    });

    return res.json({
      success: true,
      user,
      baa: {
        signed: true,
        version: user.baaVersion,
        signedAt: user.baaSignedAt,
        signerName: user.baaSignerName,
        agreementUrl: user.baaAgreementUrl,
        agreementBlobName: user.baaAgreementBlobName,
        agreementContainer: user.baaAgreementContainer,
        signatureCertificateUrl: user.baaSignatureCertificateUrl,
        signatureCertificateBlobName: user.baaSignatureCertificateBlobName,
        signatureCertificateContainer: user.baaSignatureCertificateContainer,
      },
    });
  } catch (error) {
    console.error("BAA sign error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to sign BAA",
    });
  }
});



router.get("/dashboard", authenticateCIAM, requireRegistration, async (req, res) => {
  try {
    // User data is already validated and attached by requireRegistration middleware
    res.json({
      message: "Welcome to your dashboard",
      user: {
        name: `${req.userData.firstName} ${req.userData.lastName}`,
        email: req.userData.email,
        role: req.userData.role,
        specialty: req.userData.specialty
      }
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


module.exports = router;
