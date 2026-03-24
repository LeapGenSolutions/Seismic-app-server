const { PriorityLevel } = require("@azure/cosmos");
const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function postContactEmail(email, data) {
    const database = client.database(process.env.COSMOS_DATABASE);
    const container = database.container("seismic_tickets");
    try {
        const itemData = {
            id : `${email}_${new Date().toISOString()}`,
            user_id : email,
            name : data.name,
            email : data.email,
            subject : data.subject,
            message : data.message,
            type : "contact_email",
            created_at : new Date().toISOString()
        }
        const { resource } = await container.items.create(itemData);
        return resource;
    }catch (err) {
        console.error(err);
        throw new Error("Failed to create contact email");
    }
}

async function postContactTicket(email, data) {
    const database = client.database(process.env.COSMOS_DATABASE);
    const container = database.container("seismic_tickets");
    try {
        const itemData = {
            id : `${email}_${new Date().toISOString()}`,
            user_id : email,
            name : data.name,
            email : data.email,
            subject : data.subject,
            category : data.category,
            description : data.description,
            priority : data.priority,
            status : "open",
            file : data.file,
            type : "contact_ticket",
            created_at : new Date().toISOString()
        }
        const { resource } = await container.items.create(itemData);
        return resource;
    }catch (err) {
        console.error(err);
        throw new Error("Failed to create contact ticket");
    }
};

module.exports = {
    postContactEmail,
    postContactTicket
}