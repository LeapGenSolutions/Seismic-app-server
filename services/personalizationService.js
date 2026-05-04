const { CosmosClient } = require("@azure/cosmos");
const { BlobServiceClient } = require("@azure/storage-blob");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE;
const client = new CosmosClient({ endpoint, key });

async function updateDoctorPersonalization(doctorId, personalizationData) {
    try{
        const database = client.database(databaseId);
        const container = database.container("doctors");
        const enable_transcript_purging = personalizationData.transcript_purging ? personalizationData.transcript_purging[0].enabled : personalizationData.enable_transcript_purging;
        const transcript_purging_time = personalizationData.transcript_purging ? personalizationData.transcript_purging[0].time_line : personalizationData.transcript_purging_time;
        const query = {
            query: "SELECT * FROM c WHERE c.id = @doctorId",
            parameters: [
                { name: "@doctorId", value: doctorId }
            ]
        }
        const { resources: items } = await container.items.query(query).fetchAll();
        if(items.length === 0){
            throw new Error("Doctor not found");
        }
        const doctor = items[0];
        const updatedDoctorInfo = {
            ...doctor,
            licenseNumber : personalizationData.licenseNumber || doctor.licenseNumber,
            specialization : personalizationData.specialty || doctor.specialty,
            specialty : personalizationData.specialty || doctor.specialty,
            secondaryEmail : personalizationData.secondaryEmail || doctor.secondaryEmail || "",
            subSpecialty : personalizationData.subSpecialty || doctor.subSpecialty || "",
            statesOfLicense : personalizationData.statesOfLicense || doctor.statesOfLicense || [],
            enable_transcript_purging : enable_transcript_purging || doctor.enable_transcript_purging || "No",
            transcript_purging_time : transcript_purging_time || doctor.transcript_purging_time || "",  
            middleName : personalizationData.middleName || doctor.middleName || "",
            updatedAt : new Date().toISOString()
        }
        const { resource: updatedDoctor } = await container.item(doctor.id, doctor.id).replace(updatedDoctorInfo);
        return updatedDoctor;
    } catch (error) {
        console.error("Error updating doctor personalization:", error);
        throw error;
    }
}

module.exports = {
    updateDoctorPersonalization
}