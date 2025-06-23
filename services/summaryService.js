const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchSummaryByAppointment(id, partitionKey) {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("Summaries_Container");
    try {
        const { resource } = await container.item(id, partitionKey).read();
        return resource;
    } catch (error) {
        throw new Error("Item not found");
    }
}

async function fetchSummaryOfSummaries(patientID) {
    var ssn = null;
    var newPatientID = null;
    
    // featching SSN using patientID
    const databaseSSN = client.database("seismic-chat-bot");
    const containerSSN = databaseSSN.container("Patients");

    try{
        const querySpecSSN = {
            query: "SELECT * FROM c WHERE c.original_json.patientID=@patientID",
            parameters: [
                { name: "@patientID", value: Number(patientID) }
            ]
        };
        const { resources: itemsSSN } = await containerSSN.items.query(querySpecSSN).fetchAll();
        ssn = itemsSSN[0] ? itemsSSN[0].original_json.original_json.details.ssn : null;
        
    }
    catch (error) {
        console.error(error);
        throw new Error("Failed to fetch patient SSN");
    }

    // using ssn to featch patient id
    const databasePatientID = client.database(process.env.COSMOS_DATABASE);
    const containerPatientID = databasePatientID.container("patients");
    try {
        const querySpecPatientID = {
            query: "SELECT * FROM c WHERE c.ssn=@ssn",
            parameters: [
                { name: "@ssn", value: ssn }
            ]
        };
        const { resources: itemsPatientID } = await containerPatientID.items.query(querySpecPatientID).fetchAll();
        newPatientID = itemsPatientID[0] ? itemsPatientID[0].id : null;
        
    }
    catch (error) {
        console.error(error);
        throw new Error("Failed to fetch patient ID using SSN");
    }


    // featch summary of summaries by patientID
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("DoctorPatientHistory");
    try {
        const querySpec = {
            query: "SELECT * FROM c WHERE c.patient_id = @patientID",
            parameters: [
                { name: "@patientID", value: newPatientID }
            ]
        };
        const { resources: items } = await container.items.query(querySpec).fetchAll();
        return items[0] || null;
    } catch (error) {
        console.error(error);
        throw new Error("Failed to fetch summary of summaries");
    }
}

module.exports = { fetchSummaryByAppointment, fetchSummaryOfSummaries };
