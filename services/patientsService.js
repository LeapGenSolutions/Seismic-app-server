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

// Function to generate a unique patient ID for chatbot patients
async function generateUniquePatientId(container) {
  const min = 1001;
  const max = 4301;
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


// These api's fetch data from the seismic backend.
async function fetchAllPatientsSeismic() {
    const database = client.database(process.env.COSMOS_DATABASE);
    const container = database.container("patients");
    try{
        const querySpec = { query: "SELECT * from c" };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        return items;
    } catch (error) {
        console.error("Error fetching patients from Seismic:", error);
        throw new Error("Failed to fetch patients from Seismic");
    }
}

async function fetchPatientByIdSeismic(patient_id) {
    const database = client.database(process.env.COSMOS_DATABASE);
    const container = database.container("patients");
    try{
        const querySpec = {
            query: "SELECT * from c where c.id = @id",
            parameters: [{ name: "@id", value: patient_id }]
        };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        return items[0];
    } catch (error) {
        console.error("Error fetching patient from Seismic:", error);
        throw new Error("Failed to fetch patient from Seismic");
    }
}

// Function to create a new patient or merge with existing one
async function createPatient(data) {
    const database = client.database(databaseId);
    const container = database.container("Patients");
    try{
        const firstName = (data.first_name || '').toLowerCase().trim();
        const lastName = (data.last_name || '').toLowerCase().trim();
        const email = (data.email || '').toLowerCase().trim();
        const existingPatientQuery = {
            query: "SELECT * FROM c WHERE LOWER(c.original_json.original_json.details.firstname) = @first_name AND LOWER(c.original_json.original_json.details.lastname) = @last_name AND c.original_json.original_json.details.email = @email",
            parameters: [
                { name: "@first_name", value: firstName },
                { name: "@last_name", value: lastName },
                { name: "@email", value: data.email }
            ]
        };
        const { resources: existingPatients } = await container.items.query(existingPatientQuery).fetchAll();
        if (existingPatients && existingPatients.length > 0) {
            const existingPatient = existingPatients[0];
            const merged = {
                ...existingPatient,
                original_json : {
                    ...existingPatient.original_json,
                    original_json: {
                        ...existingPatient.original_json.original_json,
                        ...data,
                    },
                },
                updated_at: new Date().toISOString()
            };
            const { resource: updatedPatient } = await container.items.upsert(merged);
            return updatedPatient;
        }
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
                   ...data,
                   ssn: String(id),
                }
            },
            created_at: new Date().toISOString(),
        };
        const { resource } = await container.items.create(newPatient);
        return resource;
    } catch (error) {
        console.log("Error creating patient:", error);
        throw new Error("Failed to create patient");
    }
}

// Function to create a new patient in Seismic backend or merge with existing one
async function createPatientSeismic(data) {
    const database = client.database(process.env.COSMOS_DATABASE);
    const container = database.container("patients");
    const chatbotDatabase = client.database(databaseId);
    const chatbotContainer = chatbotDatabase.container("Patients");
    try{
        const firstName = (data.first_name || '').toLowerCase().trim();
        const lastName = (data.last_name || '').toLowerCase().trim();
        const email = (data.email || '').toLowerCase().trim();
        let ssn = "";

        const existingPatientQueryForChatBot = {
            query: "SELECT * FROM c WHERE LOWER(c.original_json.original_json.details.firstname) = @first_name AND LOWER(c.original_json.original_json.details.lastname) = @last_name AND c.original_json.original_json.details.email = @email",
            parameters: [
                { name: "@first_name", value: firstName },
                { name: "@last_name", value: lastName },
                { name: "@email", value: email }
            ]
        };

        const {resources: existingPatientForChatBot} = await chatbotContainer.items.query(existingPatientQueryForChatBot).fetchAll();
        if(existingPatientForChatBot && existingPatientForChatBot.length == 0){
            const createPatientChatBot = await createPatient(data);
            ssn = String(createPatientChatBot.patientID);
        }
        else{
            const found = existingPatientForChatBot[0];
            ssn = String(found.patientID);
        }


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
                ssn: String(ssn),
                updated_at: new Date().toISOString()
            };
            const { resource: updatedPatient } = await container.items.upsert(merged);
            return updatedPatient;
        }
        const id = generatePatientId(data.first_name, data.last_name, ssn);
        const newPatient = {
            id: id,
            ...data,
            ssn : String(ssn), 
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
    createPatient,
    fetchAllPatientsSeismic,
    fetchPatientByIdSeismic,
    createPatientSeismic
};