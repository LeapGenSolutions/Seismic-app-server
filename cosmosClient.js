const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

const databaseId = process.env.COSMOS_DATABASE;

const client = new CosmosClient({ endpoint, key });

async function fetchAppointmentsByEmail(email) {

    const database = client.database(databaseId);
    const container = database.container("seismic_appointments");

    const querySpec = {
        query: `SELECT * from c`
    };

    const { resources: items } = await container.items.query(querySpec).fetchAll();
    filtered_items = items.map(item => {
        return {
            "id": item.id,
            "data": item.data.filter((item_t) => item_t.doctor_email.toLowerCase().includes(email.toLowerCase()))
        }
    })
    return filtered_items;

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
        const { resource } = await container.item(id, partitionKey).read()
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }

}

async function fetchBillingByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Billing_Container");

    try {
        const { resource } = await container.item(id, partitionKey).read()
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }

}

async function patchBillingByAppointment(id, partitionKey, newBillingCode) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Billing_Container");
    try {
        const { resource: item } = await container.item(id, partitionKey).read();
        const updatedItem = { ...item, "data": { "billing_codes": newBillingCode } };
        await container.item(id, partitionKey).replace(updatedItem);
    } catch (err) {
        console.error(err);
        throw new Error({ error: "Failed to update item" });
    }
}

async function fetchSummaryByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Summaries_Container");

    try {
        const { resource } = await container.item(id, partitionKey).read()
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }

}

async function fetchClustersByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Clusters_Container");

    try {
        const { resource } = await container.item(id, partitionKey).read()
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }

}

async function fetchTranscriptByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Transcription_Container");

    try {
        const { resource } = await container.item(id, partitionKey).read()
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }

}

async function fetchReccomendationByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Recommendations_Container");

    try {
        const { resource } = await container.item(id, partitionKey).read()
        return resource
    } catch (error) {
        throw new Error("Item not found")
    }

}

async function insertCallHistory(id, reqBody) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");

    try {
        const { resource } = await container.items.upsert({
            id,
            ...reqBody
        })
        return resource
    } catch (error) {
        throw new Error("Item not Inserted")
    }
}

async function fetchEmailFromCallHistory(id) {
    const database = client.database("seismic-backend-athena");
    const container = database.container("seismic_call_history");

    try {
        const querySpec = {
            query: `SELECT * from c where c.id="${id}"`
        };

        const { resources: items } = await container.items.query(querySpec).fetchAll();
        return items[0].userID
    } catch (error) {
        throw new Error("Item not found")
    }
}

module.exports = {
    fetchAppointmentsByEmail,
    fetchAllPatients,
    fetchSOAPByAppointment,
    fetchBillingByAppointment,
    fetchSummaryByAppointment,
    fetchTranscriptByAppointment,
    fetchReccomendationByAppointment,
    patchBillingByAppointment,
    fetchClustersByAppointment,
    insertCallHistory,
    fetchEmailFromCallHistory
};
