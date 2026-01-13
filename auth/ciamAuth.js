const { verifyJWT } = require("../services/tokenVerification");


async function authenticateCIAM(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "No authorization header provided"
      });
    }

    // Check if it's a Bearer token
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid authorization header format. Expected: Bearer <token>"
      });
    }

    const token = parts[1];

    // Verify our JWT token
    try {
      const decoded = verifyJWT(token);
      req.user = decoded; // Attach user info to request
      next();
    } catch (err) {
      console.error('JWT verification failed:', err.message);
      return res.status(401).json({
        error: "Unauthorized",
        message: err.message || "Invalid or expired token"
      });
    }

  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to authenticate request"
    });
  }
}


async function requireRegistration(req, res, next) {
  try {
    const { getUsersContainer } = require("../services/cosmosClient");
    const container = getUsersContainer();

    // Cross-partition query to get user from database by userId
    const querySpec = {
      query: "SELECT * FROM c WHERE c.userId = @userId",
      parameters: [{ name: "@userId", value: req.user.userId }]
    };

    const { resources } = await container.items.query(querySpec).fetchAll();

    if (resources.length === 0) {
      return res.status(403).json({
        error: "Registration incomplete",
        message: "User not found in database. Please complete registration."
      });
    }

    const user = resources[0];

    // Check if profile is complete (NPI verified)
    if (!user.profileComplete) {
      return res.status(403).json({
        error: "Registration incomplete",
        message: "Please complete your registration and NPI verification before accessing this resource.",
        requiresRegistration: true
      });
    }

    // Attach full user data to request
    req.userData = user;
    next();

  } catch (error) {
    console.error("Registration check error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to verify registration status"
    });
  }
}

module.exports = {
  authenticateCIAM,
  requireRegistration
};
