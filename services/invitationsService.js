const { v4: uuidv4 } = require("uuid");
const { getInvitationsContainer } = require("./cosmosClient");
const { buildClinicId, trimClinicName } = require("./clinicUtils");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function getInvitationByToken(token) {
  if (!token) {
    return null;
  }

  const container = getInvitationsContainer();
  const querySpec = {
    query: "SELECT TOP 1 * FROM c WHERE c.token = @token",
    parameters: [{ name: "@token", value: token }],
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  return resources[0] || null;
}

async function getInvitationForRegistration(token, email) {
  const invitation = await getInvitationByToken(token);
  if (!invitation || invitation.isActive === false) {
    throw new Error("INVITATION_NOT_FOUND");
  }

  if (invitation.consumedAt) {
    throw new Error("INVITATION_ALREADY_USED");
  }

  const normalizedEmail = normalizeEmail(email);
  if (normalizedEmail && normalizeEmail(invitation.invitedEmail) !== normalizedEmail) {
    throw new Error("INVITATION_EMAIL_MISMATCH");
  }

  return invitation;
}

async function listInvitationsForClinic(clinicName) {
  const trimmedClinicName = trimClinicName(clinicName);
  const container = getInvitationsContainer();
  const querySpec = {
    query:
      "SELECT * FROM c WHERE c.clinicName = @clinicName AND c.isActive = true AND NOT IS_DEFINED(c.consumedAt)",
    parameters: [{ name: "@clinicName", value: trimmedClinicName }],
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  return resources.sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

async function createInvitation(payload) {
  const container = getInvitationsContainer();
  const invitedEmail = normalizeEmail(payload.invitedEmail);
  const clinicName = trimClinicName(payload.clinicName);

  const duplicateQuery = {
    query:
      "SELECT TOP 1 * FROM c WHERE c.invitedEmail = @invitedEmail AND c.clinicName = @clinicName AND c.isActive = true AND NOT IS_DEFINED(c.consumedAt)",
    parameters: [
      { name: "@invitedEmail", value: invitedEmail },
      { name: "@clinicName", value: clinicName },
    ],
  };

  const { resources: duplicates } = await container.items.query(duplicateQuery).fetchAll();
  if (duplicates[0]) {
    throw new Error("INVITATION_ALREADY_EXISTS");
  }

  const now = new Date().toISOString();
  const invitation = {
    id: uuidv4(),
    token: uuidv4(),
    clinicId: buildClinicId(clinicName),
    clinicName,
    invitedEmail,
    roleName: payload.roleName,
    skipNpiValidation: Boolean(payload.skipNpiValidation),
    invitedByUserId: payload.invitedByUserId || "",
    invitedByEmail: normalizeEmail(payload.invitedByEmail),
    invitedByName: payload.invitedByName || "",
    createdAt: now,
    updatedAt: now,
    isActive: true,
    expiresAt: null,
  };

  const { resource } = await container.items.create(invitation);
  return resource;
}

async function revokeInvitation(invitationId, clinicName, revokedBy) {
  const container = getInvitationsContainer();
  const querySpec = {
    query: "SELECT TOP 1 * FROM c WHERE c.id = @id AND c.clinicName = @clinicName",
    parameters: [
      { name: "@id", value: invitationId },
      { name: "@clinicName", value: trimClinicName(clinicName) },
    ],
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  const existingInvitation = resources[0];
  if (!existingInvitation) {
    throw new Error("INVITATION_NOT_FOUND");
  }

  const updatedInvitation = {
    ...existingInvitation,
    isActive: false,
    revokedAt: new Date().toISOString(),
    revokedBy: revokedBy || "",
    updatedAt: new Date().toISOString(),
  };

  const { resource } = await container
    .item(existingInvitation.id, existingInvitation.id)
    .replace(updatedInvitation);

  return resource;
}

async function consumeInvitation(invitation, userData = {}) {
  if (!invitation?.id) {
    return null;
  }

  const container = getInvitationsContainer();
  const now = new Date().toISOString();
  const updatedInvitation = {
    ...invitation,
    consumedAt: now,
    consumedByUserId: userData.userId || "",
    consumedByEmail: normalizeEmail(userData.email),
    updatedAt: now,
  };

  const { resource } = await container
    .item(invitation.id, invitation.id)
    .replace(updatedInvitation);

  return resource;
}

module.exports = {
  normalizeEmail,
  getInvitationByToken,
  getInvitationForRegistration,
  listInvitationsForClinic,
  createInvitation,
  revokeInvitation,
  consumeInvitation,
};
