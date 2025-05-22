const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
// const key = atob(process.env.COSMOS_KEY);
const key = atob("V05qRVJaOXRpUzZhbFBkbjZJVFB3T0gzYWgxMjBQaDM2MW5IckRrQXBwd0xyQXQ1T2U0dlh4UHRFbGd1Y2lGcG9QaWxsd21qZjFta0FDRGJuYjFYc1E9PQ");

const databaseId = process.env.COSMOS_DATABASE;
const containerId = process.env.COSMOS_CONTAINER;

const client = new CosmosClient({ endpoint, key });

async function fetchAllItems() {
    
    const database = client.database(databaseId);
    const container = database.container(containerId);
    
    const querySpec = {
        query: "SELECT * from c"
    };

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    return items;
}

module.exports = { fetchAllItems };
