const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchReccomendationByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Recommendations_Container");
    try {
        const { resource } = await container.item(id, partitionKey).read();
        return resource;
    } catch (error) {
        throw new Error("Item not found");
    }
}

module.exports = { fetchReccomendationByAppointment };
