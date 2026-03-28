const { normalizeRole, PERMISSION_CATALOG } = require("../middleware/rbacAuth");

function buildBootstrapOverrides(role, existingOverrides = {}) {
  const normalizedRole = normalizeRole(role);
  const nextOverrides = { ...existingOverrides };

  if (normalizedRole === "Staff") {
    Object.keys(PERMISSION_CATALOG).forEach((permissionKey) => {
      nextOverrides[permissionKey] = "none";
    });
  }

  nextOverrides["admin.manage_rbac"] = "write";

  return nextOverrides;
}

module.exports = {
  buildBootstrapOverrides,
};
