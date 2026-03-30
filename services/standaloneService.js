const { getUsersContainer, getRolesContainer } = require("./cosmosClient");
const { buildBootstrapOverrides } = require("./bootstrapPermissions");
const { ensureClinicExists } = require("./clinicsService");
const {
  consumeInvitation,
  getInvitationForRegistration,
} = require("./invitationsService");
const { trimClinicName } = require("./clinicUtils");

const SYSTEM_REGISTRATION_ROLES = [
  { roleName: "Doctor", type: "system", skipNpiValidation: false },
  { roleName: "Nurse Practitioner", type: "system", skipNpiValidation: false },
  { roleName: "Staff", type: "system", skipNpiValidation: true },
];

function normalizeRoleName(roleName) {
  if (!roleName || typeof roleName !== "string") {
    return null;
  }

  const trimmedRoleName = roleName.trim();
  if (trimmedRoleName === "BO") {
    return "Staff";
  }

  return trimmedRoleName;
}

async function listRegistrationRoles(clinicName = "") {
  const trimmedClinicName = (clinicName || "").trim();

  if (!trimmedClinicName) {
    return SYSTEM_REGISTRATION_ROLES;
  }

  try {
    const rolesContainer = getRolesContainer();
    const querySpec = {
      query:
        "SELECT c.roleName, c.type, c.skipNpiValidation FROM c WHERE c.clinicName = @clinicName AND c.isActive = true AND c.showInRegistration = true",
      parameters: [{ name: "@clinicName", value: trimmedClinicName }],
    };

    const { resources } = await rolesContainer.items.query(querySpec).fetchAll();
    const customRoles = resources.map((roleDoc) => ({
      roleName: roleDoc.roleName,
      type: roleDoc.type || "custom",
      skipNpiValidation: Boolean(roleDoc.skipNpiValidation),
    }));

    return [...SYSTEM_REGISTRATION_ROLES, ...customRoles];
  } catch (error) {
    console.error("Failed to list registration roles:", error);
    return SYSTEM_REGISTRATION_ROLES;
  }
}

async function getRoleRegistrationConfig(roleName, clinicName = "") {
  const normalizedRoleName = normalizeRoleName(roleName);
  if (!normalizedRoleName) {
    return null;
  }

  const systemRole = SYSTEM_REGISTRATION_ROLES.find(
    (role) => role.roleName === normalizedRoleName
  );
  if (systemRole) {
    return systemRole;
  }

  const availableRoles = await listRegistrationRoles(clinicName);
  return (
    availableRoles.find((role) => role.roleName === normalizedRoleName) || null
  );
}

async function checkNPIDuplicate(npiNumber) {
  const container = getUsersContainer();

  const querySpec = {
    query: "SELECT * FROM c WHERE c.npiNumber = @npiNumber",
    parameters: [{ name: "@npiNumber", value: npiNumber }]
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  return resources.length > 0;
}

async function isFirstCompletedUserForClinic(clinicName, userId) {
  const trimmedClinicName = trimClinicName(clinicName);
  if (!trimmedClinicName) {
    return false;
  }

  const container = getUsersContainer();
  const querySpec = {
    query:
      "SELECT VALUE COUNT(1) FROM c WHERE c.profileComplete = true AND LTRIM(RTRIM(LOWER(c.clinicName))) = @clinicName AND c.userId != @userId",
    parameters: [
      { name: "@clinicName", value: trimmedClinicName.toLowerCase() },
      { name: "@userId", value: userId },
    ],
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  return (resources[0] || 0) === 0;
}


async function verifyStandaloneAuth(email, userId) {

  const container = getUsersContainer();

  // Cross-partition query by userId
  const querySpec = {
    query: "SELECT * FROM c WHERE c.userId = @userId",
    parameters: [{ name: "@userId", value: userId }]
  };

  const { resources } = await container.items.query(querySpec).fetchAll();

  // First-time user - auto-create record
  if (resources.length === 0) {
    console.log('First-time standalone user, creating record...');

    const newUser = {
      id: email,  // Using email as partition key (id)
      userId: userId,
      email: email,

      // Map to existing doctor container fields
      doctor_id: userId,
      doctor_email: email,
      doctor_name: "",  // Will be filled during registration

      authType: "CIAM",
      profileComplete: false,
      prodAccessGranted: false,
      isActive: true,
      customPermissions: {
        overrides: {},
      },
      permissionAuditLog: [],
      created_at: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    await container.items.create(newUser);

    return {
      isFirstTime: true,
      profileComplete: false,
      approvalStatus: null,
      userId: userId,
      email: email
    };
  }

  // Returning user
  const user = resources[0];

  // Update last login using email as partition key
  await container.item(user.id, user.id).patch([
    {
      op: "replace",
      path: "/lastLoginAt",
      value: new Date().toISOString()
    }
  ]);

  return {
    isFirstTime: false,
    profileComplete: user.profileComplete || false,
    approvalStatus: user.approvalStatus || (user.profileComplete ? "approved" : null),
    userId: user.userId,
    email: user.email,
    userData: user.profileComplete ? {
      firstName: user.firstName,
      lastName: user.lastName,
      npiNumber: user.npiNumber,
      specialty: user.specialty,
      role: user.role,
      clinicName: user.clinicName,
      approvalStatus: user.approvalStatus || "approved",
    } : undefined
  };
}


async function registerStandaloneUser(data) {
  const container = getUsersContainer();
  const registrationEmail = (data.primaryEmail || data.email || "").trim().toLowerCase();

   // Check for duplicate NPI
  if (data.npiNumber) {
    const npiExists = await checkNPIDuplicate(data.npiNumber);
    if (npiExists) {
      throw new Error("NPI_DUPLICATE");
    }
  }

  // Cross-partition query to fetch existing user record by userId
  const querySpec = {
    query: "SELECT * FROM c WHERE c.userId = @userId",
    parameters: [{ name: "@userId", value: data.userId }]
  };

  const { resources } = await container.items.query(querySpec).fetchAll();

  if (resources.length === 0) {
    throw new Error("User not found");
  }

  const existingUser = resources[0];
  const invitation =
    data.invitationToken
      ? await getInvitationForRegistration(data.invitationToken, registrationEmail)
      : null;
  const clinicName = invitation?.clinicName || data.clinicName || existingUser.clinicName;
  const normalizedRole = normalizeRoleName(invitation?.roleName || data.role);
  const isBootstrapClinicAdmin =
    !existingUser.profileComplete &&
    (await isFirstCompletedUserForClinic(clinicName, data.userId));
  const updatedAt = new Date().toISOString();
  const nextOverrides = isBootstrapClinicAdmin
    ? buildBootstrapOverrides(
        normalizedRole,
        (existingUser.customPermissions && existingUser.customPermissions.overrides) || {}
      )
    : {
        ...((existingUser.customPermissions && existingUser.customPermissions.overrides) || {}),
      };

  const nextAuditLog = [...(existingUser.permissionAuditLog || [])];
  if (
    isBootstrapClinicAdmin &&
    ((existingUser.customPermissions && existingUser.customPermissions.overrides?.["admin.manage_rbac"]) ||
      "none") !== "write"
  ) {
    nextAuditLog.push({
      action: "bootstrap_clinic_admin_granted",
      permission: "admin.manage_rbac",
      newLevel: "write",
      performedBy: "system-bootstrap",
      timestamp: updatedAt,
      clinicName: trimClinicName(clinicName),
    });
  }

  if (isBootstrapClinicAdmin && normalizedRole === "Staff") {
    nextAuditLog.push({
      action: "bootstrap_clinic_admin_restricted",
      newLevel: "admin-only",
      performedBy: "system-bootstrap",
      timestamp: updatedAt,
      clinicName: trimClinicName(clinicName),
    });
  }

  // Update user with registration data
  const updatedUser = {
    ...existingUser,

    // Name fields
    firstName: data.firstName,
    middleName: data.middleName || "",
    lastName: data.lastName,

    // Email fields
    primaryEmail: data.primaryEmail,
    secondaryEmail: data.secondaryEmail || "",

    // Professional Info
    role: normalizedRole,
    npiNumber: data.npiNumber || "",
    specialty: data.specialty,
    subSpecialty: data.subSpecialty || "",
    statesOfLicense: data.statesOfLicense,
    licenseNumber: data.licenseNumber || "",

    // Practice Info
    clinicName: clinicName || "",
    practiceAddress: data.practiceAddress || {},

    // Legal Agreements
    termsAccepted: data.termsAccepted,
    privacyAccepted: data.privacyAccepted,
    clinicalResponsibilityAccepted: data.clinicalResponsibilityAccepted,

    // Map to existing doctor container fields
    doctor_name: `${data.firstName} ${data.middleName ? data.middleName + ' ' : ''}${data.lastName}`.trim(),
    doctor_email: data.primaryEmail,
    specialization: data.specialty,

    // Status
    profileComplete: true,
    approvalStatus: isBootstrapClinicAdmin ? "approved" : "pending",
    approvedBy: isBootstrapClinicAdmin ? "system-bootstrap" : null,
    approvedAt: isBootstrapClinicAdmin ? updatedAt : null,
    rejectedBy: null,
    rejectedAt: null,
    invitedBy: invitation?.invitedByEmail || existingUser.invitedBy || null,
    invitationId: invitation?.id || existingUser.invitationId || null,
    invitationToken: null,
    isStandalone: true,
    signupType: data.signupType || existingUser.signupType || "standalone",
    prodAccessGranted: isBootstrapClinicAdmin,
    customPermissions: {
      ...(existingUser.customPermissions || {}),
      overrides: nextOverrides,
      ...((isBootstrapClinicAdmin || invitation)
        ? {
            lastUpdatedBy: isBootstrapClinicAdmin
              ? "system-bootstrap"
              : "invitation-registration",
            lastUpdatedAt: updatedAt,
          }
        : {}),
    },
    permissionAuditLog: nextAuditLog.slice(-50),
    updatedAt
  };

  
  const { resource } = await container
    .item(existingUser.id, existingUser.id)
    .replace(updatedUser);

  if (isBootstrapClinicAdmin) {
    await ensureClinicExists(clinicName, data.userId, registrationEmail);
  }

  if (invitation) {
    await consumeInvitation(invitation, {
      userId: data.userId,
      email: registrationEmail,
    });
  }

  console.log("User standalone Registration : Success, record updated");


  return resource;
}





module.exports = {
  verifyStandaloneAuth,
  registerStandaloneUser,
  checkNPIDuplicate,
  listRegistrationRoles,
  getRoleRegistrationConfig,
  normalizeRoleName,
};
