const express = require("express");
const router = express.Router();
const {
  getUsersContainer,
  getRolesContainer,
} = require("../services/cosmosClient");
const { listRegistrationRoles } = require("../services/standaloneService");
const {
  buildPermissionsMap,
  computeEffectivePermissions,
  isValidPermissionLevel,
  normalizeRole,
  PERMISSION_CATALOG,
  SYSTEM_ROLES,
} = require("../middleware/rbacAuth");

const MANAGED_SYSTEM_ROLES = SYSTEM_ROLES.filter((role) => role !== "SU");

const SYSTEM_ROLE_METADATA = {
  Doctor: {
    skipNpiValidation: false,
    showInRegistration: true,
  },
  "Nurse Practitioner": {
    skipNpiValidation: false,
    showInRegistration: true,
  },
  Staff: {
    skipNpiValidation: true,
    showInRegistration: true,
  },
};

function trimClinicName(value) {
  return (value || "").trim();
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "role";
}

function buildRoleId(clinicName, roleName) {
  return `${slugify(clinicName)}__${slugify(roleName)}`;
}

function getSystemRoleDocuments() {
  return MANAGED_SYSTEM_ROLES.map((roleName) => ({
    id: slugify(roleName).replace(/_/g, "-"),
    roleName,
    description: `${roleName} system role`,
    type: "system",
    clinicName: "__global__",
    baseRoleClonedFrom: "",
    permissions: computeEffectivePermissions(roleName),
    isActive: true,
    showInRegistration: SYSTEM_ROLE_METADATA[roleName].showInRegistration,
    skipNpiValidation: SYSTEM_ROLE_METADATA[roleName].skipNpiValidation,
  }));
}

function getSystemRoleByName(roleName) {
  const normalizedRole = normalizeRole(roleName);
  if (!MANAGED_SYSTEM_ROLES.includes(normalizedRole)) {
    return null;
  }

  return getSystemRoleDocuments().find(
    (roleDoc) => roleDoc.roleName === normalizedRole
  );
}

async function queryCustomRolesByClinic(clinicName, includeInactive = false) {
  const trimmedClinicName = trimClinicName(clinicName);
  if (!trimmedClinicName) {
    return [];
  }

  const rolesContainer = getRolesContainer();
  const querySpec = {
    query: includeInactive
      ? "SELECT * FROM c WHERE c.clinicName = @clinicName"
      : "SELECT * FROM c WHERE c.clinicName = @clinicName AND c.isActive = true",
    parameters: [{ name: "@clinicName", value: trimmedClinicName }],
  };

  const { resources } = await rolesContainer.items.query(querySpec).fetchAll();
  return resources;
}

async function getCustomRoleById(clinicName, roleId) {
  const trimmedClinicName = trimClinicName(clinicName);
  if (!trimmedClinicName || !roleId) {
    return null;
  }

  const roles = await queryCustomRolesByClinic(trimmedClinicName, true);
  return roles.find((roleDoc) => roleDoc.id === roleId) || null;
}

async function getAvailableRole(roleName, clinicName) {
  const systemRole = getSystemRoleByName(roleName);
  if (systemRole) {
    return systemRole;
  }

  const trimmedClinicName = trimClinicName(clinicName);
  if (!trimmedClinicName) {
    return null;
  }

  const customRoles = await queryCustomRolesByClinic(trimmedClinicName, false);
  const normalizedRole = normalizeRole(roleName);

  return (
    customRoles.find(
      (roleDoc) => normalizeRole(roleDoc.roleName) === normalizedRole
    ) || null
  );
}

function validateRolePermissions(permissionPatch = {}) {
  if (!permissionPatch || typeof permissionPatch !== "object") {
    return [];
  }

  return Object.entries(permissionPatch).filter(
    ([permissionKey, level]) =>
      !Object.prototype.hasOwnProperty.call(PERMISSION_CATALOG, permissionKey) ||
      !isValidPermissionLevel(level)
  );
}

async function buildStoredRoleDefinition(existingRole, payload) {
  const clinicName = trimClinicName(payload.clinicName || existingRole?.clinicName);
  const roleName = normalizeRole(payload.roleName || existingRole?.roleName);
  const baseRoleName = normalizeRole(
    payload.baseRoleClonedFrom || existingRole?.baseRoleClonedFrom
  );

  if (!clinicName) {
    return { error: "Clinic name is required" };
  }

  if (!roleName) {
    return { error: "Role name is required" };
  }

  if (MANAGED_SYSTEM_ROLES.includes(roleName)) {
    return { error: "System role names cannot be reused for custom roles" };
  }

  const invalidPermissions = validateRolePermissions(payload.permissions);
  if (invalidPermissions.length > 0) {
    return {
      error: "One or more permissions are invalid",
      invalidPermissions,
    };
  }

  let basePermissions = {};
  if (baseRoleName) {
    const baseRole = await getAvailableRole(baseRoleName, clinicName);
    if (!baseRole) {
      return {
        error: `Base role "${baseRoleName}" was not found for this clinic`,
      };
    }

    basePermissions = buildPermissionsMap(baseRole.permissions);
  }

  const permissions = buildPermissionsMap({
    ...basePermissions,
    ...(payload.permissions || existingRole?.permissions || {}),
  });

  return {
    roleDoc: {
      ...(existingRole || {}),
      id: existingRole?.id || buildRoleId(clinicName, roleName),
      roleName,
      description: payload.description?.trim() || "",
      type: "custom",
      clinicName,
      baseRoleClonedFrom: baseRoleName || "",
      permissions,
      isActive: existingRole?.isActive ?? true,
      showInRegistration: Boolean(payload.showInRegistration),
      skipNpiValidation: Boolean(payload.skipNpiValidation),
    },
  };
}

router.get("/roles/registration/:clinicName", async (req, res) => {
  try {
    const roles = await listRegistrationRoles(req.params.clinicName);
    return res.json(roles);
  } catch (error) {
    console.error("RBAC registration roles error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch registration roles",
    });
  }
});

router.get("/roles", async (req, res) => {
  try {
    const clinicName = trimClinicName(req.query.clinicName);
    const customRoles = clinicName
      ? await queryCustomRolesByClinic(clinicName, false)
      : [];

    return res.json([...getSystemRoleDocuments(), ...customRoles]);
  } catch (error) {
    console.error("RBAC roles list error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch RBAC roles",
    });
  }
});

router.get("/roles/:id", async (req, res) => {
  try {
    const roleId = req.params.id;
    const systemRole = getSystemRoleDocuments().find((role) => role.id === roleId);
    if (systemRole) {
      return res.json(systemRole);
    }

    const clinicName = trimClinicName(req.query.clinicName);
    if (!clinicName) {
      return res.status(400).json({
        error: "Invalid request",
        message: "clinicName is required",
      });
    }

    const customRole = await getCustomRoleById(clinicName, roleId);
    if (!customRole) {
      return res.status(404).json({
        error: "Not found",
        message: "Role was not found",
      });
    }

    return res.json(customRole);
  } catch (error) {
    console.error("RBAC role fetch error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to fetch RBAC role",
    });
  }
});

router.post("/roles", async (req, res) => {
  try {
    const clinicName = trimClinicName(req.body?.clinicName);
    if (!clinicName) {
      return res.status(400).json({
        error: "Invalid request",
        message: "clinicName is required",
      });
    }

    const roleName = normalizeRole(req.body?.roleName);
    if (!roleName) {
      return res.status(400).json({
        error: "Invalid request",
        message: "roleName is required",
      });
    }

    const existingRoles = await queryCustomRolesByClinic(clinicName, true);
    const duplicateRole = existingRoles.find(
      (roleDoc) => normalizeRole(roleDoc.roleName) === roleName
    );

    if (duplicateRole) {
      return res.status(409).json({
        error: "Conflict",
        message: "A role with this name already exists for the clinic",
      });
    }

    const { roleDoc, error, invalidPermissions } = await buildStoredRoleDefinition(
      null,
      req.body || {}
    );

    if (error) {
      return res.status(400).json({
        error: "Invalid request",
        message: error,
        invalidPermissions,
      });
    }

    const now = new Date().toISOString();
    const payload = {
      ...roleDoc,
      createdBy: req.body?.performedBy || "rbac-ui",
      createdAt: now,
      updatedBy: req.body?.performedBy || "rbac-ui",
      updatedAt: now,
    };

    const { resource } = await getRolesContainer().items.create(payload);

    return res.status(201).json({
      success: true,
      role: resource,
    });
  } catch (error) {
    console.error("RBAC create role error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to create RBAC role",
    });
  }
});

router.put("/roles/:id", async (req, res) => {
  try {
    const clinicName = trimClinicName(req.body?.clinicName);
    if (!clinicName) {
      return res.status(400).json({
        error: "Invalid request",
        message: "clinicName is required",
      });
    }

    const existingRole = await getCustomRoleById(clinicName, req.params.id);
    if (!existingRole) {
      return res.status(404).json({
        error: "Not found",
        message: "Role was not found",
      });
    }

    const nextRoleName = normalizeRole(req.body?.roleName || existingRole.roleName);
    const duplicateRoles = await queryCustomRolesByClinic(clinicName, true);
    const duplicateRole = duplicateRoles.find(
      (roleDoc) =>
        roleDoc.id !== existingRole.id &&
        normalizeRole(roleDoc.roleName) === nextRoleName
    );

    if (duplicateRole) {
      return res.status(409).json({
        error: "Conflict",
        message: "A role with this name already exists for the clinic",
      });
    }

    const { roleDoc, error, invalidPermissions } = await buildStoredRoleDefinition(
      existingRole,
      req.body || {}
    );

    if (error) {
      return res.status(400).json({
        error: "Invalid request",
        message: error,
        invalidPermissions,
      });
    }

    const updatedRole = {
      ...existingRole,
      ...roleDoc,
      updatedBy: req.body?.performedBy || "rbac-ui",
      updatedAt: new Date().toISOString(),
    };

    const { resource } = await getRolesContainer()
      .item(existingRole.id, clinicName)
      .replace(updatedRole);

    return res.json({
      success: true,
      role: resource,
    });
  } catch (error) {
    console.error("RBAC update role error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to update RBAC role",
    });
  }
});

router.delete("/roles/:id", async (req, res) => {
  try {
    const clinicName = trimClinicName(req.query.clinicName || req.body?.clinicName);
    const replacementRoleName = normalizeRole(req.body?.replacementRoleName);
    if (!clinicName) {
      return res.status(400).json({
        error: "Invalid request",
        message: "clinicName is required",
      });
    }

    const existingRole = await getCustomRoleById(clinicName, req.params.id);
    if (!existingRole) {
      return res.status(404).json({
        error: "Not found",
        message: "Role was not found",
      });
    }

    const usersContainer = getUsersContainer();
    const affectedUsersQuery = {
      query:
        "SELECT * FROM c WHERE c.clinicName = @clinicName AND c.role = @roleName",
      parameters: [
        { name: "@clinicName", value: clinicName },
        { name: "@roleName", value: existingRole.roleName },
      ],
    };

    const { resources: affectedUsers } = await usersContainer.items
      .query(affectedUsersQuery)
      .fetchAll();

    let replacementRole = null;
    if (affectedUsers.length > 0) {
      if (!replacementRoleName) {
        return res.status(400).json({
          error: "Invalid request",
          message: "replacementRoleName is required when users are assigned to this role",
        });
      }

      if (replacementRoleName === normalizeRole(existingRole.roleName)) {
        return res.status(400).json({
          error: "Invalid request",
          message: "Replacement role must be different from the role being deleted",
        });
      }

      replacementRole = await getAvailableRole(replacementRoleName, clinicName);
      if (!replacementRole) {
        return res.status(400).json({
          error: "Invalid request",
          message: "The selected replacement role is not available for this clinic",
        });
      }

      const updatedAt = new Date().toISOString();
      for (const existingUser of affectedUsers) {
        const updatedUser = {
          ...existingUser,
          role: normalizeRole(replacementRole.roleName) || replacementRole.roleName,
          updatedAt,
        };
        delete updatedUser.baaSignatureHistory;

        await usersContainer
          .item(existingUser.id, existingUser.id)
          .replace(updatedUser);
      }
    }

    const nextRole = {
      ...existingRole,
      isActive: false,
      updatedBy: req.body?.performedBy || "rbac-ui",
      updatedAt: new Date().toISOString(),
    };

    await getRolesContainer()
      .item(existingRole.id, clinicName)
      .replace(nextRole);

    return res.json({
      success: true,
      roleId: existingRole.id,
      affectedUsers: affectedUsers.map((user) => ({
        userId: user.userId,
        email: user.email,
        id: user.id,
      })),
      reassignedTo: replacementRole?.roleName || null,
      reassignedUserCount: affectedUsers.length,
    });
  } catch (error) {
    console.error("RBAC delete role error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to delete RBAC role",
    });
  }
});

router.put("/users/assign-role", async (req, res) => {
  try {
    const { userIds, roleName } = req.body || {};
    const clinicName = trimClinicName(req.body?.clinicName);

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        error: "Invalid request",
        message: "userIds must be a non-empty array",
      });
    }

    if (!clinicName) {
      return res.status(400).json({
        error: "Invalid request",
        message: "clinicName is required",
      });
    }

    const targetRole = await getAvailableRole(roleName, clinicName);
    if (!targetRole) {
      return res.status(400).json({
        error: "Invalid request",
        message: "The selected role is not available for this clinic",
      });
    }

    const container = getUsersContainer();
    const querySpec = {
      query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@userIds, c.userId)",
      parameters: [{ name: "@userIds", value: userIds }],
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    const userMap = new Map(resources.map((user) => [user.userId, user]));
    const updatedUsers = [];
    const updatedAt = new Date().toISOString();

    for (const userId of userIds) {
      const existingUser = userMap.get(userId);
      if (!existingUser || trimClinicName(existingUser.clinicName) !== clinicName) {
        continue;
      }

      const updatedUser = {
        ...existingUser,
        role: normalizeRole(targetRole.roleName) || targetRole.roleName,
        updatedAt,
      };
      delete updatedUser.baaSignatureHistory;

      const { resource } = await container
        .item(existingUser.id, existingUser.id)
        .replace(updatedUser);

      updatedUsers.push({
        userId: resource.userId,
        email: resource.email,
        role: resource.role,
      });
    }

    return res.json({
      success: true,
      updatedCount: updatedUsers.length,
      users: updatedUsers,
    });
  } catch (error) {
    console.error("RBAC assign role error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to assign RBAC role",
    });
  }
});

router.put("/manage", async (req, res) => {
  try {
    const { userIds, overrides } = req.body || {};

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        error: "Invalid request",
        message: "userIds must be a non-empty array",
      });
    }

    if (!overrides || typeof overrides !== "object") {
      return res.status(400).json({
        error: "Invalid request",
        message: "overrides must be an object",
      });
    }

    const invalidOverrides = Object.entries(overrides).filter(
      ([permissionKey, level]) =>
        !Object.prototype.hasOwnProperty.call(PERMISSION_CATALOG, permissionKey) ||
        !isValidPermissionLevel(level)
    );

    if (invalidOverrides.length > 0) {
      return res.status(400).json({
        error: "Invalid request",
        message: "One or more overrides are invalid",
        invalidOverrides: invalidOverrides.map(([permissionKey, level]) => ({
          permissionKey,
          level,
        })),
      });
    }

    const container = getUsersContainer();
    const querySpec = {
      query: "SELECT * FROM c WHERE ARRAY_CONTAINS(@userIds, c.userId)",
      parameters: [{ name: "@userIds", value: userIds }],
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    const userMap = new Map(resources.map((user) => [user.userId, user]));
    const updatedUsers = [];
    const updatedAt = new Date().toISOString();

    for (const userId of userIds) {
      const existingUser = userMap.get(userId);

      if (!existingUser) {
        continue;
      }

      const nextOverrides = {
        ...((existingUser.customPermissions && existingUser.customPermissions.overrides) || {}),
        ...overrides,
      };

      const auditEntries = Object.entries(overrides).map(([permission, newLevel]) => ({
        action: "override_set",
        permission,
        newLevel,
        performedBy: req.body.performedBy || "rbac-ui",
        timestamp: updatedAt,
      }));

      const updatedUser = {
        ...existingUser,
        customPermissions: {
          ...existingUser.customPermissions,
          overrides: nextOverrides,
          lastUpdatedBy: req.body.performedBy || "rbac-ui",
          lastUpdatedAt: updatedAt,
        },
        permissionAuditLog: [
          ...((existingUser.permissionAuditLog || []).slice(-49)),
          ...auditEntries,
        ],
        updatedAt,
      };
      delete updatedUser.baaSignatureHistory;

      const { resource } = await container
        .item(existingUser.id, existingUser.id)
        .replace(updatedUser);

      updatedUsers.push({
        userId: resource.userId,
        email: resource.email,
        customPermissions: resource.customPermissions,
      });
    }

    return res.json({
      success: true,
      updatedCount: updatedUsers.length,
      users: updatedUsers,
    });
  } catch (error) {
    console.error("RBAC manage error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to update RBAC overrides",
    });
  }
});

module.exports = router;
