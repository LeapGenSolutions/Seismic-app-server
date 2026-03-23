const { getRolesContainer } = require("../services/cosmosClient");

const ACCESS_HIERARCHY = {
  none: 0,
  read: 1,
  write: 2,
};

const SYSTEM_ROLES = ["Doctor", "Nurse Practitioner", "Staff", "SU"];

const ROLE_ALIASES = {
  doctor: "Doctor",
  np: "Nurse Practitioner",
  "nurse practitioner": "Nurse Practitioner",
  nurse_practitioner: "Nurse Practitioner",
  staff: "Staff",
  bo: "Staff",
  "back office": "Staff",
  "staff (back office)": "Staff",
  su: "SU",
  "super admin": "SU",
};

const PERMISSION_CATALOG = {
  "dashboard.view_appointments": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "dashboard.start_video_call": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "none",
  },
  "dashboard.todays_schedule": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "dashboard.status_overview": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "dashboard.provider_workload": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "chatbot.access": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "appointments.select_providers": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "appointments.add": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "appointments.modify": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "appointments.delete": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "appointments.patient_reports": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "read",
  },
  "appointments.join_call": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "none",
  },
  "appointments.post_call_doc": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "read",
  },
  "video_call.upcoming": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "read",
  },
  "video_call.start": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "none",
  },
  "video_call.add": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "video_call.history": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "read",
  },
  "video_call.post_call_doc": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "read",
  },
  "post_call.view_all": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "read",
  },
  "post_call.edit_soap_notes": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "read",
  },
  "post_call.edit_billing_codes": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "post_call.add_doctor_notes": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "read",
  },
  "post_call.edit_doctor_notes": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "none",
  },
  "post_call.add_feedback": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "none",
  },
  "post_call.edit_feedback": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "none",
  },
  "patients.info": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "patients.clinical_summary": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "read",
  },
  "patients.upcoming_appointment": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "patients.join_call": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "none",
  },
  "patients.previous_calls": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "write",
  },
  "patients.post_call_doc": {
    Doctor: "write",
    "Nurse Practitioner": "write",
    Staff: "read",
  },
  "reports.billing_analytics": {
    Doctor: "write",
    "Nurse Practitioner": "none",
    Staff: "none",
  },
  "reports.billing_history": {
    Doctor: "write",
    "Nurse Practitioner": "none",
    Staff: "none",
  },
  "reports.estimated_billing": {
    Doctor: "write",
    "Nurse Practitioner": "none",
    Staff: "none",
  },
  "settings.ehr_integration": {
    Doctor: "write",
    "Nurse Practitioner": "read",
    Staff: "read",
  },
  "settings.payment_billing": {
    Doctor: "write",
    "Nurse Practitioner": "none",
    Staff: "none",
  },
  "admin.manage_rbac": {
    Doctor: "none",
    "Nurse Practitioner": "none",
    Staff: "none",
  },
};

function normalizeRole(input) {
  if (!input || typeof input !== "string") {
    return null;
  }

  return ROLE_ALIASES[input.trim().toLowerCase()] || input;
}

function isValidPermissionLevel(level) {
  return Object.prototype.hasOwnProperty.call(ACCESS_HIERARCHY, level);
}

function buildPermissionsMap(permissionSource = {}) {
  return Object.keys(PERMISSION_CATALOG).reduce((acc, permissionKey) => {
    const level = permissionSource?.[permissionKey];
    acc[permissionKey] = isValidPermissionLevel(level) ? level : "none";
    return acc;
  }, {});
}

async function resolveCustomRolePermissions(role, clinicName) {
  const normalizedRole = normalizeRole(role);
  const trimmedClinicName = (clinicName || "").trim();

  if (!normalizedRole || SYSTEM_ROLES.includes(normalizedRole) || !trimmedClinicName) {
    return null;
  }

  try {
    const rolesContainer = getRolesContainer();
    const querySpec = {
      query:
        "SELECT TOP 1 c.permissions FROM c WHERE c.roleName = @roleName AND c.clinicName = @clinicName AND c.isActive = true",
      parameters: [
        { name: "@roleName", value: normalizedRole },
        { name: "@clinicName", value: trimmedClinicName },
      ],
    };

    const { resources } = await rolesContainer.items.query(querySpec).fetchAll();
    return resources[0]?.permissions || null;
  } catch (error) {
    console.error("Failed to resolve custom role permissions:", error);
    return null;
  }
}

function computeEffectivePermissions(role, customPermissions, customRolePermissions = null) {
  const normalizedRole = normalizeRole(role);
  const permissions = SYSTEM_ROLES.includes(normalizedRole)
    ? Object.fromEntries(
        Object.entries(PERMISSION_CATALOG).map(([permissionKey, defaults]) => [
          permissionKey,
          defaults[normalizedRole] || "none",
        ])
      )
    : buildPermissionsMap(customRolePermissions);

  const overrides = customPermissions && customPermissions.overrides
    ? customPermissions.overrides
    : {};

  Object.entries(overrides).forEach(([permissionKey, level]) => {
    if (
      Object.prototype.hasOwnProperty.call(PERMISSION_CATALOG, permissionKey) &&
      isValidPermissionLevel(level)
    ) {
      permissions[permissionKey] = level;
    }
  });

  return permissions;
}

async function getEffectivePermission(userData, permissionKey, customRolePermissions = null) {
  const resolvedCustomRolePermissions =
    customRolePermissions ||
    (await resolveCustomRolePermissions(
      userData && userData.role,
      userData && userData.clinicName
    ));

  return computeEffectivePermissions(
    userData && userData.role,
    userData && userData.customPermissions,
    resolvedCustomRolePermissions
  )[permissionKey] || "none";
}

function authorizePermission(requiredKey, requiredLevel = "write") {
  return async (req, res, next) => {
    const level = await getEffectivePermission(
      req.userData,
      requiredKey,
      req.customRolePermissions
    );

    if (ACCESS_HIERARCHY[level] < ACCESS_HIERARCHY[requiredLevel]) {
      return res.status(403).json({
        error: "Forbidden",
        message: "Insufficient privileges for this action",
        permission: requiredKey,
        requiredLevel,
        actualLevel: level,
      });
    }

    next();
  };
}

module.exports = {
  ACCESS_HIERARCHY,
  SYSTEM_ROLES,
  PERMISSION_CATALOG,
  normalizeRole,
  isValidPermissionLevel,
  buildPermissionsMap,
  resolveCustomRolePermissions,
  computeEffectivePermissions,
  getEffectivePermission,
  authorizePermission,
};
