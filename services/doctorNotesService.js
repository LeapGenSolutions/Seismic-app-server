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
    if (!resource) {
      throw new Error("Item not found");
    }
    return resource;
  } catch (error) {
    throw new Error("Item not found");
  }
}

async function patchDoctorNotesByAppointment(
  id,
  updatedData
) {
  const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
  const container = database.container("DoctorNotes_Container");
  console.log(updatedData);
  
  const { userID, content, priority, title, tags } = updatedData;
  const newId = `${userID}_${id}_DoctorNotes`;
  try {
    const { resource: item } = await container.item(newId, userID).read();
    const updatedItem = {
      ...item,
      data: {
        doctor_notes: content ? content : item.data.doctor_notes,
        priority: priority ? priority : item.data.priority,
        title: title ? title : item.data.title,
        tags: tags ? tags : item.data.tags,
      },
      last_update: new Date().toISOString(),
    };
    // console.log(updatedItem);
    
    await container.item(newId, userID).replace(updatedItem);
  } catch (err) {
    console.error(err);
    throw new Error({ error: "Failed to update item" });
  }
}

async function createDoctorNotes(appointmentId, notesData) {
  const { user_id, doctor_notes, priority, doctor_notes_title, tags } = notesData
  const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
  const container = database.container("DoctorNotes_Container");
  const item = {
    id: `${user_id}_${appointmentId}_DoctorNotes`,
    userID: user_id,
    session_id: appointmentId,
    type: "doctor_notes",
    data: {
      title: doctor_notes_title,
      priority: priority === null ? "High" : priority,
      doctor_notes,
      tags: tags
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
