const crypto = require('crypto');
const { CosmosClient } = require("@azure/cosmos");
const { param } = require("../routes/callHistory");
const { create } = require('domain');
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = "seismic-chat-bot";
const client = new CosmosClient({ endpoint, key });

function generatePatientId(firstName, lastName, ssn) {
  const base = `${firstName.toLowerCase().trim()}_${lastName.toLowerCase().trim()}_${ssn.trim()}`;
  return crypto.createHash('sha256').update(base, 'utf8').digest('hex');
}

async function fetchAllPatients() {
    const database = client.database(databaseId);
    const container = database.container("Patients");
    const querySpec = { query: "SELECT c.original_json from c" };
    const { resources: items } = await container.items.query(querySpec).fetchAll();
    const result = items.map(item => {

        if (item?.original_json?.details) {
            return {
                "patient_id": item?.original_json?.patient_id,
                "practice_id": item?.original_json?.practice_id,
                ...item?.original_json?.details
            }
        }
        if (!item?.original_json?.details) {
            return {
                "patient_id": item?.original_json?.patientID,
                "practice_id": item?.original_json?.practiceID,
                ...item?.original_json?.original_json?.details
            }
        }
    })
    return result;
}

async function fetchPatientById(patient_id) {
    const database = client.database(databaseId);
    const container = database.container("Patients");
    const querySpec = {
        query: "SELECT c.original_json from c where c.patientID = @patientId",
        parameters: [{ name: "@patientId", value: Number(patient_id) }]
    };
    const { resources: items } = await container.items.query(querySpec).fetchAll();
    const item = items[0];
    let result = {};
    if (item?.original_json?.details) {
        result =  {
            "patient_id": item?.original_json?.patient_id,
            "practice_id": item?.original_json?.practice_id,
            ...item?.original_json?.details
        }
    }
    if (!item?.original_json?.details) {
        result = {
            "patient_id": item?.original_json?.patientID,
            "practice_id": item?.original_json?.practiceID,
            ...item?.original_json?.original_json?.details
        }
    }
    return result;
}

async function createPatient(data) {
    const database = client.database(process.env.COSMOS_DATABASE || databaseId);
    const container = database.container("patients");
    try{
        const firstName = (data.first_name || '').toLowerCase().trim();
        const lastName = (data.last_name || '').toLowerCase().trim();
        const ssn = (data.ssn || '').trim();
        const existingPatientQuery = {
            query: "SELECT * FROM c WHERE LOWER(c.first_name) = @first_name AND LOWER(c.last_name) = @last_name AND c.ssn = @ssn",
            parameters: [
                { name: "@first_name", value: firstName },
                { name: "@last_name", value: lastName },
                { name: "@ssn", value: ssn }
            ]
        };
        const { resources: existingPatients } = await container.items.query(existingPatientQuery).fetchAll();
        if (existingPatients && existingPatients.length > 0) {
            const existingPatient = existingPatients[0];
            const merged = {
                ...existingPatient,
                ...data,
                updated_at: new Date().toISOString()
            };
            const { resource: updatedPatient } = await container.items.upsert(merged);
            return updatedPatient;
        }
        const id = generatePatientId(data.first_name, data.last_name, data.ssn);
        const newPatient = {
            id: id,
            ...data,
            created_at: new Date().toISOString(),
        };
        const { resource } = await container.items.create(newPatient);
        return resource;
    } catch (error) {
        console.log("Error creating patient:", error);
        throw new Error("Failed to create patient");
    }
}

module.exports = {
    fetchAllPatients,
    fetchPatientById,
    createPatient
};
