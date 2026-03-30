function trimClinicName(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function normalizeClinicName(value) {
  return trimClinicName(value).toLowerCase();
}

function buildClinicId(value) {
  const slug = trimClinicName(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "clinic";
}

module.exports = {
  trimClinicName,
  normalizeClinicName,
  buildClinicId,
};
