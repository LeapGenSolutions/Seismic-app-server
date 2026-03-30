const { getClinicsContainer } = require("./cosmosClient");
const {
  buildClinicId,
  normalizeClinicName,
  trimClinicName,
} = require("./clinicUtils");

async function searchClinics(searchTerm, limit = 10) {
  const trimmedSearch = trimClinicName(searchTerm);
  if (trimmedSearch.length < 2) {
    return [];
  }

  const container = getClinicsContainer();
  const querySpec = {
    query:
      "SELECT * FROM c WHERE c.isActive = true AND (CONTAINS(LOWER(c.clinicName), @search) OR CONTAINS(c.normalizedName, @search))",
    parameters: [{ name: "@search", value: trimmedSearch.toLowerCase() }],
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  return resources
    .sort((a, b) =>
      String(a.clinicName || "").localeCompare(String(b.clinicName || ""), undefined, {
        sensitivity: "base",
      })
    )
    .slice(0, limit);
}

async function getClinicByName(clinicName) {
  const normalizedName = normalizeClinicName(clinicName);
  if (!normalizedName) {
    return null;
  }

  const container = getClinicsContainer();
  const querySpec = {
    query: "SELECT TOP 1 * FROM c WHERE c.normalizedName = @normalizedName",
    parameters: [{ name: "@normalizedName", value: normalizedName }],
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  return resources[0] || null;
}

async function createClinic(clinicName, createdByUserId, createdByEmail) {
  const trimmedClinicName = trimClinicName(clinicName);
  const normalizedName = normalizeClinicName(trimmedClinicName);
  if (!trimmedClinicName) {
    throw new Error("Clinic name is required");
  }

  const container = getClinicsContainer();
  const now = new Date().toISOString();
  const clinicDoc = {
    id: buildClinicId(trimmedClinicName),
    clinicName: trimmedClinicName,
    normalizedName,
    createdBy: createdByUserId || "",
    createdByEmail: (createdByEmail || "").trim().toLowerCase(),
    createdAt: now,
    updatedAt: now,
    isActive: true,
  };

  const { resource } = await container.items.upsert(clinicDoc);
  return resource;
}

async function ensureClinicExists(clinicName, createdByUserId, createdByEmail) {
  const existingClinic = await getClinicByName(clinicName);
  if (existingClinic) {
    return existingClinic;
  }

  return createClinic(clinicName, createdByUserId, createdByEmail);
}

module.exports = {
  searchClinics,
  getClinicByName,
  createClinic,
  ensureClinicExists,
};
