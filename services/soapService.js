const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchSOAPByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("SOAP_Container");
    try {
        const { resource } = await container.item(id, partitionKey).read();
        return resource;
    } catch (error) {
        throw new Error("Item not found");
    }
}

async function patchSoapNotesByAppointment(id, partitionKey, updatedSoap) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("SOAP_Container");
    try {
        const { resource: item } = await container.item(id, partitionKey).read();
        const updatedData = { 
            ...item.data, 
            "soap_notes": updatedSoap?.soapNotes || item.data.soap_notes, 
            "procedure_notes": updatedSoap?.procedureNotes || item.data.procedure_notes, 
            "orders": updatedSoap?.orders || item.data.orders
        };
        const updatedItem = { ...item, "data": updatedData };
        await container.item(id, partitionKey).replace(updatedItem);
    } catch (err) {
        console.error(err);
        throw new Error({ error: "Failed to update SOAP notes" });
    }
}

module.exports = { fetchSOAPByAppointment, patchSoapNotesByAppointment };
