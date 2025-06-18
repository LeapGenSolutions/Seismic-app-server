const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE;
const client = new CosmosClient({ endpoint, key });

async function fetchAppointmentsByEmail(email) {
    const database = client.database(databaseId);
    const container = database.container("seismic_appointments");
    const querySpec = { query: `SELECT * from c` };
    const { resources: items } = await container.items.query(querySpec).fetchAll();
    const filtered_items = items.map(item => ({
        id: item.id,
        data: item.data.filter((item_t) => item_t.doctor_email.toLowerCase().includes(email.toLowerCase()))
    }));
    return filtered_items;
}

module.exports = { fetchAppointmentsByEmail };
