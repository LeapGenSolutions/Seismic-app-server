const { CosmosClient } = require("@azure/cosmos");
const { fetchAllPatientsSeismic } = require("./patientsService");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchEmotionalEmpathy(data, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Patient_Persona_Container");
    const patientDatabase = client.database(process.env.COSMOS_DATABASE);
    const patientContainer = patientDatabase.container("patients");
    const email = (data.email || '').toLowerCase().trim();
    try{
        // robust, case-insensitive lookup
        const querySpec = {
            query: "SELECT * FROM c WHERE LOWER(c.first_name) = @first_name AND LOWER(c.last_name) = @last_name AND LOWER(c.email) = @email",
            parameters: [
                { name: "@first_name", value: (data.first_name || '').toLowerCase().trim() },
                { name: "@last_name",  value: (data.last_name  || '').toLowerCase().trim() },
                { name: "@email",      value: email }
            ]
        };

        const { resources: patientRows } = await patientContainer.items.query(querySpec).fetchAll();
        if (!patientRows || patientRows.length === 0) {
            throw new Error("Patient not found in patients container");
        }

        // patientRows entries are full documents -> extract id
        const patientDoc = patientRows[0];
        const id = `${partitionKey}_${patientDoc.id}`;
        if (!id) throw new Error("No document id found for patient");
        const { resource } = await container.item(id, partitionKey).read();
        return resource;
    }
    catch (error) {
        console.log(error);
        throw new Error("Item not found");  
    }
}

async function fetchLongitudinalSentiment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Sentiment_Container");
    try{
        const { resource } = await container.item(id, partitionKey).read();
        return resource;
    }
    catch (error) {
        console.log(error);
        throw new Error("Item not found");
    }
}

async function fetchSentimentAnalysis(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Sentiment_Container");
    try{
        const { resource } = await container.item(id, partitionKey).read();
        return resource;
    }
    catch (error) {
        console.log(error);
        throw new Error("Item not found");
    }
}

module.exports = { fetchEmotionalEmpathy, fetchLongitudinalSentiment, fetchSentimentAnalysis };