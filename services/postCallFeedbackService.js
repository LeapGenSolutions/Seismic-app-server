const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchPostCallFeedbackByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_DATABASE);
    const container = database.container("post_call_feedbak");
    const newId = `${partitionKey}_${id}_PostCallFeedback`;
    try {
        const { resource } = await container.item(newId, partitionKey).read();
        return resource;
    } catch (error) {
        throw new Error("Item not found");  
    }
}


async function createPostCallFeedback(userId, appointmentId, data) {
    const database = client.database(process.env.COSMOS_DATABASE);
    const container = database.container("post_call_feedbak");
    const id = `${userId}_${appointmentId}_PostCallFeedback`;
    try {
        const {resource : existingItem} = await container.item(id, userId).read();

        if (existingItem) {
            const updatedItem = {
                ...existingItem,
                overallExperience: data.overallExperience || existingItem.overallExperience,
                summaryAccuracy: data.summaryAccuracy || existingItem.summaryAccuracy,
                soapHelpfulness: data.soapHelpfulness || existingItem.soapHelpfulness,
                billingAccuracy: data.billingAccuracy || existingItem.billingAccuracy,
                transcriptAccuracy: data.transcriptAccuracy || existingItem.transcriptAccuracy,
                featureSuggestions: data.featureSuggestions || existingItem.featureSuggestions,
                last_update: new Date().toISOString(),
            }
            await container.item(id, userId).replace(updatedItem);
            return updatedItem;
        }
        
        const item = {
            id : `${userId}_${appointmentId}_PostCallFeedback`,
            user_id: userId,
            appointment_id: appointmentId,
            overallExperience: data.overallExperience,
            summaryAccuracy: data.summaryAccuracy,
            soapHelpfulness: data.soapHelpfulness,
            billingAccuracy: data.billingAccuracy,
            transcriptAccuracy: data.transcriptAccuracy,
            featureSuggestions: data.featureSuggestions,
            created_at: new Date().toISOString(),
        }
        const { resource } = await container.items.create(item);
        return resource;
    }catch (error) {
        console.error("Error creating post call feedback:", error);
        throw new Error("Failed to create post call feedback");
    }
}

module.exports = {
    createPostCallFeedback,
    fetchPostCallFeedbackByAppointment
};