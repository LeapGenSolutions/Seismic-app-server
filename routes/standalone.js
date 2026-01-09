const express = require("express");
const router = express.Router();
const { verifyStandaloneAuth, registerStandaloneUser } = require("../services/standaloneService");
const { verifyIdToken, generateJWT, extractUserInfo } = require("../services/tokenVerification");
const { authenticateCIAM, requireRegistration } = require("../middleware/ciamAuth");



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

    // Use userId from verified token
    data.userId = req.user.userId;

    // Validate required fields
    const required = [
      'firstName',
      'lastName',
      'primaryEmail',
      'role',
      'npiNumber',
      'specialty',
      'statesOfLicense',
      'termsAccepted',
      'privacyAccepted',
      'clinicalResponsibilityAccepted'
    ];

    const missing = required.filter(field => !data[field]);

    if (missing.length > 0) {
      return res.status(400).json({
        error: "Missing required fields",
        fields: missing
      });
    }

    // Validate NPI format (exactly 10 digits)
    if (!/^\d{10}$/.test(data.npiNumber)) {
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

    // Validate legal agreements are true
    if (!data.termsAccepted || !data.privacyAccepted || !data.clinicalResponsibilityAccepted) {
      return res.status(400).json({
        error: "All legal agreements must be accepted"
      });
    }

    // Validate role
    const validRoles = ['Doctor', 'Nurse Practitioner'];
    if (!validRoles.includes(data.role)) {
      return res.status(400).json({
        error: "Invalid role",
        message: "Role must be 'Doctor' or 'Nurse Practitioner'"
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

    res.json(user);

  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
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