const crypto = require('crypto');
const { CosmosClient } = require("@azure/cosmos");
//const { param } = require("../routes/callHistory");
//const { create } = require('domain');
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = "seismic-chat-bot";
const client = new CosmosClient({ endpoint, key });

function generatePatientId(firstName, lastName, ssn) {
  const base = `${firstName.toLowerCase().trim()}_${lastName.toLowerCase().trim()}_${ssn.trim()}`;
  return crypto.createHash('sha256').update(base, 'utf8').digest('hex');
}

// Generate unique numeric patient ID (chatbot DB)
async function generateUniquePatientId(container) {
  const min = 1001;
  const max = 6000;
  let randomNum, id, { resources: existing } = { resources: [] };

  do {
    randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
    id = `patient_${randomNum}`;

    const query = {
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [{ name: "@id", value: id }],
    };

    const { resources } = await container.items.query(query).fetchAll();
    existing = resources;
  } while (existing.length > 0);

  return randomNum;
}

/* ---------------- READ : ALL PATIENTS ---------------- */

async function fetchAllPatients() {
  const database = client.database(databaseId);
  const container = database.container("Patients");

  const querySpec = { query: "SELECT c.original_json FROM c" };
  const { resources } = await container.items.query(querySpec).fetchAll();

  return resources.map(item => {
    const oj = item.original_json;

    // ✅ NEW FORMAT
    if (oj?.original_json?.details) {
      return {
        patient_id: oj.original_json.patient_id,
        practice_id: oj.original_json.practice_id,
        ...oj.original_json.details,
      };
    }

    // 🧯 OLD FORMAT
    if (oj?.original_json?.original_json?.details) {
      const d = oj.original_json.original_json.details;

      return {
        patient_id: oj.patientID,
        practice_id: oj.practiceID,
        firstname: d.first_name || "",
        lastname: d.last_name || "",
        dob: d.dob || "",
        sex: d.gender || "",
        email: d.email || "",
        contactmobilephone: d.phone || "",
        ssn: d.ssn || "",
      };
    }

    return null;
  }).filter(Boolean);
}

/* ---------------- READ : PATIENT BY ID ---------------- */

async function fetchPatientById(patient_id) {
  const database = client.database(databaseId);
  const container = database.container("Patients");

  const querySpec = {
    query: "SELECT c.original_json FROM c WHERE c.patientID = @patientId",
    parameters: [{ name: "@patientId", value: Number(patient_id) }]
  };

  const { resources } = await container.items.query(querySpec).fetchAll();
  const oj = resources?.[0]?.original_json;
  if (!oj) return null;

  // ✅ NEW FORMAT
  if (oj?.original_json?.details) {
    return {
      patient_id: oj.original_json.patient_id,
      practice_id: oj.original_json.practice_id,
      ...oj.original_json.details,
    };
  }

  // 🧯 OLD FORMAT
  if (oj?.original_json?.original_json?.details) {
    const d = oj.original_json.original_json.details;

    return {
      patient_id: oj.patientID,
      practice_id: oj.practiceID,
      firstname: d.first_name || "",
      lastname: d.last_name || "",
      dob: d.dob || "",
      sex: d.gender || "",
      email: d.email || "",
      contactmobilephone: d.phone || "",
      ssn: d.ssn || "",
    };
  }

  return null;
}

/* ---------------- CREATE : CHATBOT (NEW FORMAT ONLY) ---------------- */

async function createPatient(data) {
  const database = client.database(databaseId);
  const container = database.container("Patients");

  const id = await generateUniquePatientId(container);
  const practice_id = Math.floor(Math.random() * (99999 - 10000 + 1)) + 10000;

  const newPatient = {
    id: `patient_${id}`,
    patientID: id,
    practiceID: practice_id,
    original_json: {
      id: `patient_${id}`,
      patientID: id,
      practiceID: practice_id,
      original_json: {
        patient_id: id,
        practice_id: practice_id,
        details: {
          firstname: data.firstname || data.first_name || "",
          middlename: data.middlename || "",
          lastname: data.lastname || data.last_name || "",
          dob: data.dob || "",
          sex: data.sex || data.gender || "",
          address1: data.address1 || "",
          city: data.city || "",
          state: data.state || "",
          zip: data.zip || "",
          countrycode: data.countrycode || "USA",
          email: data.email || "",
          contactmobilephone: data.contactmobilephone || data.phone || "",
          contacthomephone: data.contacthomephone || "",
          contactpreference: data.contactpreference || "",
          ehr: data.ehr || "",
          mrn: data.mrn || "",
          ssn: String(id),
          maritalstatus: data.maritalstatus || "",
          employername: data.employername || "",
          employerphone: data.employerphone || "",
          preferredpronouns: data.preferredpronouns || "",
          portalaccessgiven: data.portalaccessgiven || "N",
          portalsignatureonfile: !!data.portalsignatureonfile,
          portalstatus: data.portalstatus || [
            {
                registeredyn: "Y",
                status: "Active",
                lastlogindate: new Date().toISOString().split("T")[0],
                portalregistrationdate: new Date().toISOString().split("T")[0]
            }
            ],
          privacyinformationverified: !!data.privacyinformationverified,
          race: data.race || "",
          ethnicitycode: data.ethnicitycode || "",
          language6392code: data.language6392code || "en",
        }
      }
    },
    created_at: new Date().toISOString(),
  };

  const { resource } = await container.items.create(newPatient);
  return resource;
}

/* ---------------- SEISMIC BACKEND ---------------- */

async function fetchAllPatientsSeismic() {
  const database = client.database(process.env.COSMOS_DATABASE);
  const container = database.container("patients");
  const { resources } = await container.items.query({ query: "SELECT * FROM c" }).fetchAll();
  return resources;
}

async function fetchPatientByIdSeismic(patient_id) {
  const database = client.database(process.env.COSMOS_DATABASE);
  const container = database.container("patients");
  const { resources } = await container.items.query({
    query: "SELECT * FROM c WHERE c.id = @id",
    parameters: [{ name: "@id", value: patient_id }]
  }).fetchAll();
  return resources[0];
}

async function createPatientSeismic(data) {
  const database = client.database(process.env.COSMOS_DATABASE);
  const container = database.container("patients");

  const ssn = data.ssn;
  const id = await generatePatientId(
    data.first_name || data.firstname || "",
    data.last_name || data.lastname || "",
    ssn
  );

  const newPatient = {
    id,
    ...data,
    ssn: String(ssn),
    created_at: new Date().toISOString(),
  };

  const { resource } = await container.items.create(newPatient);
  return resource;
}

/* ---------------- CREATE BOTH ---------------- */

async function createPatientBoth(data) {
  const chatbotPatient = await createPatient(data);
  const patientID = chatbotPatient.patientID;

  const seismicPatient = await createPatientSeismic({
    ...data,
    ssn: String(patientID),
  });

  return { chatbotPatient, seismicPatient };
}

module.exports = {
  fetchAllPatients,
  fetchPatientById,
  createPatient,
  fetchAllPatientsSeismic,
  fetchPatientByIdSeismic,
  createPatientSeismic,
  createPatientBoth
};