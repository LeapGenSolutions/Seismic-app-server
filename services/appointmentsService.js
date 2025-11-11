const { CosmosClient } = require("@azure/cosmos");
const crypto = require("crypto");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE;
const client = new CosmosClient({ endpoint, key });

// Generates 24-char random ID for appointment
function generateId(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

// Generate doctor_id in correct 32-character hex format
function generateDoctorId(doctorEmail) {
  const base = doctorEmail.toLowerCase().trim() + Date.now().toString();
  return crypto.createHash("md5").update(base).digest("hex");
}

async function fetchAppointmentsByEmail(email) {
  const database = client.database(databaseId);
  const seismic_appointments_container = database.container("seismic_appointments");
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

  const { resources: items } = await seismic_appointments_container.items.query(seismicQuery).fetchAll();
  return items;
}

async function fetchAppointmentsByEmails(emails) {
  if (!Array.isArray(emails) || emails.length === 0) return [];
  const database = client.database(databaseId);
  const seismic_appointments_container = database.container("seismic_appointments");
  try {
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

    const { resources: items } = await seismic_appointments_container.items.query(seismicQuery).fetchAll();
    return items;
  } catch (error) {
    console.error("Error fetching appointments by emails:", error);
    throw error;
  }
}

async function createAppointment(userId, data) {
  const database = client.database(databaseId);
  const container = database.container("seismic_appointments");
  const normalizedDoctorEmail = (userId || '').toLowerCase();
  const currentDate = new Date().toISOString().slice(0, 10);

  const patientId = Number(data.patient_id);
  const doctorId = generateDoctorId(normalizedDoctorEmail); //  Always proper 32-char format

  const newAppointment = {
    id: generateId(24),
    type: "appointment",
    first_name: data.first_name,
    last_name: data.last_name,
    full_name: data.full_name,
    dob: data.dob,
    gender: data.gender,
    ssn: String(patientId),
    doctor_id: doctorId,
    doctor_name: data.doctor_name,
    doctor_email: normalizedDoctorEmail,
    specialization: data.specialization,
    status: data.status || 'scheduled',
    email: data.email,
    phone: data.phone,
    time: data.time,
    patient_id: patientId,
    practice_id: "12345",
    insurance_verified: data.insurance_verified || false,
    insurance_provider: data.insurance_provider,
    appointment_date: data.appointment_date
  };

  try {
    let existingAppointments = null;
    try {
      const query = {
        query: `SELECT * FROM c WHERE c.id = @id`,
        parameters: [{ name: "@id", value: currentDate }]
      };
      const { resources: results } = await container.items.query(query).fetchAll();
      existingAppointments = results ? results[0].data : null;
    } catch (qErr) {
      console.error('Fallback query to read date document failed:', qErr);
      existingAppointments = null;
    }

    const updatedData = existingAppointments && Array.isArray(existingAppointments)
      ? [...existingAppointments, newAppointment]
      : [newAppointment];

    const { resource: createdItem } = await container.items.upsert({ id: currentDate, data: updatedData });
    return createdItem;
  } catch (error) {
    console.error("Error creating custom appointment:", error);
    throw error;
  }
}

module.exports = { fetchAppointmentsByEmail, fetchAppointmentsByEmails, createAppointment };