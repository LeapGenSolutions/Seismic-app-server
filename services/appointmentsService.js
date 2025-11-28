const { CosmosClient } = require("@azure/cosmos");
const { BlobServiceClient } = require("@azure/storage-blob");
const crypto = require("crypto");
const { start } = require("repl");
const { blob } = require("stream/consumers");
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
  const doctorId = data.doctor_id;

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

const createBulkAppointments = async (file, data) => {
  const blobServiceClient = BlobServiceClient.fromConnectionString(process.env.RECORDINGS_BLOB_CONNECTION_STRING);
  const containerClient = blobServiceClient.getContainerClient("seismic-appointment-uploads");
  const blobName = `${Date.now()}-${file.originalname}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  try {
    await blockBlobClient.uploadData(file.buffer);
    const resource  = await startJob({
      "env": "dev",
      "file_name": blobName,
      "doctor_name": data.doctor_name,
      "doctor_email": data.userId,
      "specialization": data.specialization,
      "practice_id": data.practice_id,
      "doctor_id": data.doctor_id
    });
    return { message: "File uploaded successfully", fileName : blobName, fileUrl: blockBlobClient.url, resource };
  } catch (error) {
    console.error("Error uploading bulk appointments file:", error);
    throw error;
  }
};

const getToken = async () => {
  try{
    const url = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/token`;
    const params = new URLSearchParams();
    params.append("client_id", process.env.CLIENT_ID);
    params.append("client_secret", process.env.CLIENT_SECRET);
    params.append("grant_type", "client_credentials");
    params.append("resource", "2ff814a6-3304-4ab8-85cb-cd0e6f879c1d");
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
      body: params
    });
    const data = await response.json();
    return data.access_token;
  }catch (err){
    console.error("error: ", err);
    throw err;
  }
}

const startJob = async(data) => {
  try{
    const response = await fetch(`${process.env.DATABRICKS_WORKSPACE_URL}/api/2.1/jobs/run-now`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getToken()}`,
          'content-type': 'application/json'
        },
        body : JSON.stringify({
            "job_id" : process.env.JOB_ID,
            "notebook_params" : data
          }
        )
      }
    )
    const result = await response.json();
    return result;   
  }catch(err){
    console.error("error starting job: ", err);
    throw err;
  }
}

const deleteAppointment = async (user_id, appointmentId) => {
  const database = client.database(databaseId);
  const container = database.container("seismic_appointments");
  const normalizedDoctorEmail = (user_id || '').toLowerCase();
  try{
    const today = new Date().toISOString().slice(0, 10);
    const quesry = {
      query: `SELECT * FROM c WHERE c.id = @id`,
      parameters: [{ name: "@id", value: today }]
    };
    const { resources: results } = await container.items.query(quesry).fetchAll();
    if(results.length === 0){
      throw new Error("No appointments found for today");
    }
    const todaysAppointments = results[0].data;
    const filteredAppointments = todaysAppointments.filter(app => !(app.id === appointmentId && app.doctor_email === normalizedDoctorEmail));
    await container.items.upsert({ id: today, data: filteredAppointments });
  }catch(err){
    console.error("error deleting appointment: ", err);
    throw err;
  }
};

const updateAppointment = async (user_id, appointmentId, updatedData) => {
  const database = client.database(databaseId);
  const container = database.container("seismic_appointments");
  const normalizedDoctorEmail = (user_id || '').toLowerCase();
  try{
    const today = new Date().toISOString().slice(0, 10);
    const quesry = {
      query: `SELECT * FROM c WHERE c.id = @id`,
      parameters: [{ name: "@id", value: today }]
    };
    const { resources: results } = await container.items.query(quesry).fetchAll();
    if(results.length === 0){
      throw new Error("No appointments found for today");
    }
    const todaysAppointments = results[0].data;
    const updatedAppointments = todaysAppointments.map(app => {
      if(app.id === appointmentId && app.doctor_email === normalizedDoctorEmail){
        return { ...app, ...updatedData };
      }
      return app;
    });
    await container.items.upsert({ id: today, data: updatedAppointments });
  }catch(err){
    console.error("error updating appointment: ", err);
    throw err;
  }
}


module.exports = { fetchAppointmentsByEmail, fetchAppointmentsByEmails, createAppointment, createBulkAppointments, deleteAppointment, updateAppointment };