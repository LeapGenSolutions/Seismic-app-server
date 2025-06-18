const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function insertCallHistory(id, reqBody) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");
    try {
        const { resource } = await container.items.upsert({ id, ...reqBody });
        return resource;
    } catch (error) {
        throw new Error("Item not Inserted");
    }
}

async function updateCallHistory(id, updatedBody) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");
    try {
        const querySpec = { query: `SELECT * from c where c.id="${id}"` };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        const existingItem = items[0];
        const updatedItem = { ...existingItem, ...updatedBody };
        const { resource: replacedItem } = await container.item(id, existingItem.userID).replace(updatedItem);
        return replacedItem;
    } catch (error) {
        throw new Error("Item not updated");
    }
}

async function fetchEmailFromCallHistory(id) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");
    try {
        const querySpec = { query: `SELECT * from c where c.id="${id}"` };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        return items[0].userID;
    } catch (error) {
        throw new Error("Item not found");
    }
}

async function fetchCallHistoryFromEmail(userID) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");
    try {
        const querySpec = { query: `SELECT TOP 10 * from c where c.userID="${userID}"` };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        return items;
    } catch (error) {
        throw new Error("Item not found");
    }
}

async function fetchDoctorsFromCallHistory() {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");
    try {
        const querySpec = { query: `SELECT distinct c.userID, c.fullName from c` };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        return items;
    } catch (error) {
        throw new Error("Item not found");
    }
}

module.exports = {
    insertCallHistory,
    updateCallHistory,
    fetchEmailFromCallHistory,
    fetchCallHistoryFromEmail,
    fetchDoctorsFromCallHistory
};
