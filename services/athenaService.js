const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

async function postVisitReason(appointmentId, data) {
    try{
        const {response} = await fetch(`${process.env.COSMOS_ENCOUNTERS_API}/api/v1/encounters/${appointmentId}/visit-reason`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                note : data.note,
                append : data.append
            })
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error posting visit reason:", error);
    }
}

async function putPhysicalExam(PRACTICE_ID, ENCOUNTER_ID, data) {
    try{
        const {response} = await fetch(`${process.env.COSMOS_ENCOUNTERS_API}/v1/${PRACTICE_ID}/chart/encounter/${ENCOUNTER_ID}/physicalexam`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                note : data.note,
                append : data.append
            })
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("ErrPUTing visit reason:", error);
    }
}

async function putHPI(appointmentId, data) {
    try{
        const {response} = await fetch(`${process.env.COSMOS_ENCOUNTERS_API}/api/v1/encounters/${appointmentId}/hpi`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                note : data.note,
                append : data.append
            })
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error posting HPI:", error);
    }
}

async function putReviewOfSystems(appointmentId, data) {
    try{
        const {response} = await fetch(`${process.env.COSMOS_ENCOUNTERS_API}/api/v1/encounters/${appointmentId}/review-of-systems`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        return result;
    }
    catch (error) {
        console.error("Error posting review of systems:", error);
    }
}

async function putAssessment(appointmentId, data) {
    try{
        const {response} = await fetch(`${process.env.COSMOS_ENCOUNTERS_API}/api/v1/encounters/${appointmentId}/assessment`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
                note : data.note,
                append : data.append
            })
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error putting assessment:", error);
    }
}

module.exports = { postVisitReason, putPhysicalExam, putHPI, putReviewOfSystems, putAssessment };


// PRACTICE_ID = "1959979"
// PATIENT_ID = "870"
// ENCOUNTER_ID = "59271"
// CLIENT_ID = "0oax609jhy6tsI5if297"
// CLIENT_SECRET = "xoR5DXdwGTGjJPoOprCb5-BoA6lxugahMFEltWlugFDsyqbaOqotRHUxyKEH7VgV"
// BASE_URL = "https://api.preview.platform.athenahealth.com"
// TOKEN_URL = f"{BASE_URL}/oauth2/v1/token"