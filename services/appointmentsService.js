const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE;
const client = new CosmosClient({ endpoint, key });

async function fetchAppointmentsByEmail(email) {
    const database = client.database(databaseId);
    const seismic_appointments_container = database.container("seismic_appointments");
    const custom_appointment_container = database.container("custom_appointment");
    const doctorEmail = (email || '').toLowerCase();

    const seismicQuery = {
        query: `SELECT 
                    c.id AS appointment_date,
                    d.id,
                    d.type,
                    d.first_name,
                    d.last_name,
                    d.full_name,
                    d.dob,
                    d.gender,
                    d.mrn,
                    d.ehr,
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
                WHERE lower(d.doctor_email) = @doctorEmail`,
        parameters: [{ name: "@doctorEmail", value: doctorEmail }]
    };

    const customQuery = {
        query: `SELECT 
                    c.appointment_date AS appointment_date,
                    c.id,
                    c.type,
                    c.first_name,
                    c.last_name,
                    c.full_name,
                    c.dob,
                    c.gender,
                    c.mrn,
                    c.ehr,
                    c.ssn,
                    c.doctor_name,
                    c.doctor_id,
                    lower(c.doctor_email) as doctor_email,
                    c.specialization,
                    c.time,
                    c.status,
                    c.insurance_provider,
                    c.email,
                    c.phone,
                    c.insurance_verified,
                    c.patient_id,
                    c.practice_id
                FROM c
                WHERE lower(c.doctor_email) = @doctorEmail`,
        parameters: [{ name: "@doctorEmail", value: doctorEmail }]
    };

    const { resources: seismicItems } = await seismic_appointments_container.items.query(seismicQuery).fetchAll();
    const { resources: customItems } = await custom_appointment_container.items.query(customQuery).fetchAll();

    const items = [];
    if (Array.isArray(seismicItems)) items.push(...seismicItems);
    if (Array.isArray(customItems)) items.push(...customItems);

    console.log(`custom items: ${JSON.stringify(customItems)}`);
    return items;
}

async function fetchAppointmentsByEmails(emails) {
    if (!Array.isArray(emails) || emails.length === 0) return [];
    const database = client.database(databaseId);
    const seismic_appointments_container = database.container("seismic_appointments");
    const custom_appointment_container = database.container("custom_appointment");
    // Prepare parameters and IN clause
    try{
        const lowerEmails = emails.map(e => (e || '').toLowerCase());
        const emailParams = lowerEmails.map((_, idx) => `@email${idx}`);

        const seismicQuery = {
            query: `SELECT 
                        c.id AS appointment_date,
                        d.id,
                        d.type,
                        d.first_name,
                        d.last_name,
                        d.full_name,
                        d.dob,
                        d.gender,
                        d.mrn,
                        d.ehr,
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

        const customQuery = {
            query: `SELECT
                        c.appointment_date AS appointment_date,
                        c.id,
                        c.type,
                        c.first_name,
                        c.last_name,
                        c.full_name,
                        c.dob,
                        c.gender,
                        c.mrn,
                        c.ehr,
                        c.ssn,
                        c.doctor_name,
                        c.doctor_id,
                        lower(c.doctor_email) as doctor_email,
                        c.specialization,
                        c.time,
                        c.status,
                        c.insurance_provider,
                        c.email,
                        c.phone,
                        c.insurance_verified,
                        c.patient_id,
                        c.practice_id
                    FROM c
                    WHERE lower(c.doctor_email) IN (${emailParams.join(", ")})`,
            parameters: lowerEmails.map((email, idx) => ({ name: `@email${idx}`, value: email }))
        };

        const { resources: seismicItems } = await seismic_appointments_container.items.query(seismicQuery).fetchAll();
        const { resources: customItems } = await custom_appointment_container.items.query(customQuery).fetchAll();

        const items = [];
        if (Array.isArray(seismicItems)) items.push(...seismicItems);
        if (Array.isArray(customItems)) items.push(...customItems);
        return items;
    }catch (error) {
        console.error("Error fetching appointments by emails:", error);
        throw error;
    }
}

async function createCustomAppointment(userId, data) {
    const database = client.database(databaseId);
    const container = database.container("custom_appointment");
    const normalizedDoctorEmail = (data.doctor_email || '').toLowerCase();
    const newAppointment = {
        id : `custom-appointment-${uuidv4()}-${Date.now()}`,
        user_id : userId,
        clinic_name : data.clinic_name,
        clinic_code : data.clinic_code,
        first_name : data.first_name,
        last_name : data.last_name,
        full_name : data.full_name,
        type: "custom",
        dob: data.dob,
        gender : data.gender,
        mrn : data.mrn,
        ehr : data.ehr,
        doctor_name : data.doctor_name,
        doctor_email : normalizedDoctorEmail,
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
