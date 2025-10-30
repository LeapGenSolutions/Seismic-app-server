const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");

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

async function fetchAppointmentsByEmails(emails) {
    if (!Array.isArray(emails) || emails.length === 0) return [];
    const database = client.database(databaseId);
    const container = database.container("seismic_appointments");
    // Prepare parameters and IN clause
    const lowerEmails = emails.map(e => e.toLowerCase());
    const emailParams = lowerEmails.map((email, idx) => `@email${idx}`);
    const querySpec = {
        query: `SELECT 
                    c.id AS appointment_date,
                    d.id,
                    d.type,
                    d.first_name,
                    d.last_name,
                    d.full_name,
                    d.ssn,
                    d.doctor_name,
                    d.doctor_id,
                    lower(d.doctor_email) as doctor_email,
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
                JOIN d IN c.data 
                WHERE lower(d.doctor_email) IN (${emailParams.join(", ")})`,
        parameters: lowerEmails.map((email, idx) => ({ name: `@email${idx}`, value: email }))
    };
    const { resources: items } = await container.items.query(querySpec).fetchAll();
    return items;
}

async function createCustomAppointment(userId, data) {
    const database = client.database(databaseId);
    const container = database.container("custom_appointment");
    const newAppointment = {
        id : `${userId}-${uuidv4()}-${Date.now()}`,
        user_id : userId,
        clinic_name : data.clinic_name,
        clinic_code : data.clinic_code,
        first_name : data.first_name,
        last_name : data.last_name,
        full_name : data.full_name,
        dob: data.dob,
        gender : data.gender,
        mrn : data.mrn,
        ehr : data.ehr,
        doctor_name : data.doctor_name,
        doctor_email : data.doctor_email,
        specialization : data.specialization,
        status : data.status || 'scheduled',
        email : data.email,
        phone : data.phone,
        time : data.time,
        appointment_date : data.appointment_date,
        created_at : new Date().toISOString()
    }
    try {
        const { resource: createdItem } = await container.items.create(newAppointment);
        return createdItem;
    } catch (error) {
        console.error("Error creating custom appointment:", error);
        throw error;
    }
}

module.exports = { fetchAppointmentsByEmail, fetchAppointmentsByEmails, createCustomAppointment };
