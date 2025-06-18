const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchSummaryByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Summaries_Container");
    try {
        const { resource } = await container.item(id, partitionKey).read();
        return resource;
    } catch (error) {
        throw new Error("Item not found");
    }
}

async function fetchSummaryOfSummaries(patientID) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("DoctorPatientHistory");
    try {
        const querySpec = {
            query: "SELECT * FROM c WHERE c.patient_id = @patientID",
            parameters: [
                { name: "@patientID", value: patientID }
            ]
        };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        return items[0] || null;
    } catch (error) {
        console.error(error);
        throw new Error("Failed to fetch summary of summaries");
    }
}

module.exports = { fetchSummaryByAppointment, fetchSummaryOfSummaries };
