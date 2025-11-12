const { CosmosClient } = require("@azure/cosmos");
const { fetchAllPatientsSeismic } = require("./patientsService");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchEmotionalEmpathy(ssn, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Patient_Persona_Container");
    try{
        const patients = await fetchAllPatientsSeismic();
        const patient = patients.find(p => p.ssn === ssn);
        const patientId = patient ? patient.id : ssn;
        id = `${partitionKey}_${patientId}`;
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