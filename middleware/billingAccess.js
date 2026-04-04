const { authenticateCIAM, requireRegistration } = require("./ciamAuth");
const requireDoctorRole = require("./requireDoctorRole");

// Chains: authenticateCIAM → requireRegistration → requireDoctorRole
const billingAccess = [authenticateCIAM, requireRegistration, requireDoctorRole];

module.exports = billingAccess;
