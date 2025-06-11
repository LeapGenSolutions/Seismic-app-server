import { ServiceBusClient } from "@azure/service-bus";

// Replace with your connection string and queue name
const connectionString = process.env.SERVICE_BUS_CONNECTION_STRING
const queueName = process.env.SERVICE_BUS_QUEUE;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const sendMessage = async (userId, sessionID) => {
    console.log(`${userId} :: ${sessionID} :: Inside sendMessage started`);
    const sbClient = new ServiceBusClient(connectionString);
    console.log(`${userId} :: ${sessionID} :: sbCLientCreated`);
    const sender = sbClient.createSender(queueName);
    console.log(`${userId} :: ${sessionID} :: sender message created`);
    
    const message = {
        body: {
            "type": "end_of_session",
            "userID": userId,
            "sessionID": sessionID
        },
        contentType: "application/json",
        sessionId: sessionID
        
    };
    try {
        console.log(`${userId} :: ${sessionID} :: delaying for 15s`);
        await delay(15000); // 15 seconds
        console.log(`${userId} :: ${sessionID} :: sender message sending`);
        await sender.sendMessages(message);
        console.log(`${userId} :: ${sessionID} :: sender message sent`);
        console.log("Message sent successfully");
    } catch (error) {
        console.log(error);        
        throw new Error("Error sending message:", error);
    } finally {
        await sender.close();
        await sbClient.close();
    }
}
