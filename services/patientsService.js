const { CosmosClient } = require("@azure/cosmos");
const { param } = require("../routes/callHistory");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = "seismic-chat-bot";
const client = new CosmosClient({ endpoint, key });

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

module.exports = {
    fetchAllPatients,
    fetchPatientById
};
