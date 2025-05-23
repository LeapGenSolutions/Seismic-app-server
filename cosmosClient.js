const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

const databaseId = process.env.COSMOS_DATABASE;
const containerId = process.env.COSMOS_CONTAINER;

const client = new CosmosClient({ endpoint, key });

async function fetchAllAppointments() {
    
    const database = client.database(databaseId);
    const container = database.container(containerId);
    
    const querySpec = {
        query: "SELECT * from c"
    };

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    return items;
}

async function fetchAllPatients() {
    
    const database = client.database(databaseId);
    const container = database.container(process.env.COSMOS_PATIENTS_CONTAINER);
    
    const querySpec = {
        query: "SELECT * from c"
    };

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    return items;
}

module.exports = { fetchAllAppointments, fetchAllPatients };
