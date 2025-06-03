const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

const databaseId = process.env.COSMOS_DATABASE;

const client = new CosmosClient({ endpoint, key });

async function fetchAllAppointments() {
    
    const database = client.database(databaseId);
    const container = database.container("seismic_appointments");
    
    const querySpec = {
        query: "SELECT * from c"
    };

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    return items;
}

async function fetchAllPatients() {
    
    const database = client.database(databaseId);
    const container = database.container("patients");
    
    const querySpec = {
        query: "SELECT * from c"
    };

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    return items;
}

async function fetchSOAPByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("SOAP_Container");

    try {
        const {resource} = await container.item(id,partitionKey).read()        
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }
    
}

async function fetchBillingByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Billing_Container");

    try {
        const {resource} = await container.item(id,partitionKey).read()        
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }
    
}

async function fetchSummaryByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Summaries_Container");

    try {
        const {resource} = await container.item(id,partitionKey).read()        
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }
    
}

async function fetchTranscriptByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Transcription_Container");

    try {
        const {resource} = await container.item(id,partitionKey).read()        
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }
    
}

async function fetchReccomendationByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Recommendations_Container");

    try {
        const {resource} = await container.item(id,partitionKey).read()        
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }
    
}

module.exports = { 
    fetchAllAppointments, 
    fetchAllPatients, 
    fetchSOAPByAppointment,
    fetchBillingByAppointment,
    fetchSummaryByAppointment,
    fetchTranscriptByAppointment,
    fetchReccomendationByAppointment
};
