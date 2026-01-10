const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchBillingByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Billing_Container");
    try {
        const { resource } = await container.item(id, partitionKey).read();
        return resource;
    } catch (error) {
        throw new Error("Item not found");
    }
}

async function patchBillingByAppointment(id, partitionKey, data) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Billing_Container");
    try {
        const incomingValue = (data?.billing_codes ?? data?.engine_v1_gpt);
        const { resource: item } = await container.item(id, partitionKey).read();
        const hasEngineV1 = item.data?.engine_v1_gpt !== undefined;
        const updatedItem = { ...item,
            data : {
                ...item.data,
                ...(hasEngineV1
                    ? { engine_v1_gpt: incomingValue }
                    : { billing_codes: incomingValue }),
                engine_v2_search:data.engine_v2_search ?? item.data.engine_v2_search
            }
        };
        const { resource: replacedItem } = await container.item(id, partitionKey).replace(updatedItem);
        return replacedItem
    } catch (err) {
        console.error(err);
        throw new Error("Failed to update item");
    }
}

module.exports = { fetchBillingByAppointment, patchBillingByAppointment };