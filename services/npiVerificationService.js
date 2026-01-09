import axios from "axios";

export const verifyNPI = async (npiNumber) => {

  if (!/^\d{10}$/.test(npiNumber)) {
    return { valid: false, reason: "Invalid NPI format" };
  }

const url = `https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${npiNumber}`;

const { data } = await axios.get(url, {
  headers: {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json"
  },
  timeout: 5000
});


 
  if (!data.results || data.results.length === 0) {
    return { valid: false, reason: "NPI not found" };
  }

  const provider = data.results[0];

  return {
    valid: true,
    npi: provider.number,
    enumerationType: provider.enumeration_type,
    status: provider.basic?.status,
    name:
      provider.basic?.organization_name ||
      `${provider.basic?.first_name} ${provider.basic?.last_name}`
  };
};
