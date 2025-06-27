const { PriorityLevel } = require("@azure/cosmos");
const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchDoctorNotesByAppointment(id, partitionKey) {
  const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
  const container = database.container("DoctorNotes_Container");
  const newId = `${partitionKey}_${id}_DoctorNotes`;
  try {
    const { resource } = await container.item(newId, partitionKey).read();
    return resource;
  } catch (error) {
    throw new Error("Item not found");
  }
}

async function patchDoctorNotesByAppointment(
  id,
  partitionKey,
  newNotes,
  priority
) {
  const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
  const container = database.container("DoctorNotes_Container");
  const newId = `${partitionKey}_${id}_DoctorNotes`;
  try {
    const { resource: item } = await container.item(newId, partitionKey).read();
    console.log(item.priority);

    const updatedItem = {
      ...item,
      data: { doctor_notes: newNotes ? newNotes : item.data.doctor_notes },
      last_update: new Date().toISOString(),
      priority: priority === null ? item.priority : priority,
    };
    await container.item(newId, partitionKey).replace(updatedItem);
  } catch (err) {
    console.error(err);
    throw new Error({ error: "Failed to update item" });
  }
}

async function createDoctorNotes(appointmentId, userID, doctorNotes, priority) {
  const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
  const container = database.container("DoctorNotes_Container");
  const item = {
    id: `${userID}_${appointmentId}_DoctorNotes`,
    userID: userID,
    session_id: appointmentId,
    type: "doctor_notes",
    priority: priority === null ? "High" : priority,
    data: {
      doctor_notes: doctorNotes,
    },
    created_at: new Date().toISOString(),
    last_update: new Date().toISOString(),
  };
  try {
    const { resource: createdItem } = await container.items.create(item);
    return createdItem;
  } catch (error) {
    console.error(error);
    throw new Error("Failed to create doctor notes");
  }
}

module.exports = {
  fetchDoctorNotesByAppointment,
  patchDoctorNotesByAppointment,
  createDoctorNotes,
};
