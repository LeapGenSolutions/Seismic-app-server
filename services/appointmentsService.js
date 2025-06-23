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
        query: `SELECT 
                    c.id AS appointment_date,
                    d.id,
                    d.type,
                    d.first_name,
                    d.last_name,
                    d.full_name,
                    d.ssn,
                    lower(d.doctor_name),
                    d.doctor_id,
                    d.doctor_email,
                    d.specialization,
                    d.time,
                    d.status,
                    d.insurance_provider,
                    d.email,
                    d.phone,
                    d.insurance_verified,
                    d.patient_id,
                    d.practice_id
                FROM c
                JOIN d IN c.data where lower(d.doctor_email) = @doctorEmail`,
        parameters: [{ name: "@doctorEmail", value: email.toLowerCase() }]
    };
    const { resources: items } = await container.items.query(querySpec).fetchAll();
    return items;
}

module.exports = { fetchAppointmentsByEmail };
