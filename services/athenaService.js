require("dotenv").config();

async function getToken() {
const clientId = process.env.ATHENA_CLIENT_ID;
    const clientSecret = process.env.ATHENA_CLIENT_SECRET;
    const basicAuth = Buffer
        .from(`${clientId}:${clientSecret}`)
        .toString("base64");

    const body = new URLSearchParams({
        grant_type: "client_credentials",
        scope: "athena/service/Athenanet.MDP.*"
    });

    const response = await fetch(
        `${process.env.ATHENA_BASE_URL}/oauth2/v1/token`,
        {
            method: "POST",
            headers: {
                "Authorization": `Basic ${basicAuth}`,
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body
        }
    );

    if (!response.ok) {
        throw new Error(`Token failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.access_token;
}


async function postVisitReason(practiceId, encounterId, noteText) {
    const token = await getToken();
    const body = new URLSearchParams({
        notetext: noteText,
        appendtext: "false"
    });

    const response = await fetch(
        `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/encounterreasonnote`,
        {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body
        }
    );

    if (!response.ok) {
        throw new Error(`Visit Reason failed: ${response.statusText}`);
    }

    return await response.json();
}


async function putPhysicalExam(practiceId, encounterId, note) {
    const token = await getToken();

    const body = new URLSearchParams({
        sectionnote: note,
        replacesectionnote: "true"
    });

    const response = await fetch(
        `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/physicalexam`,
        {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body
        }
    );

    if (!response.ok) {
        throw new Error(`Physical Exam failed: ${response.statusText}`);
    }

    return await response.json();
}


async function putHPI(practiceId, encounterId, noteText) {
    try {
        const token = await getToken();

        const body = new URLSearchParams({
            sectionnote: noteText,
            replacesectionnote: "true"
        });

        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/hpi`,
            {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body
            }
        );

        if (!response.ok) {
            throw new Error(`HPI failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating HPI:", error.message);
        throw error;
    }
}


async function putReviewOfSystems(practiceId, encounterId, noteText) {
    try {
        const token = await getToken();

        const body = new URLSearchParams({
            sectionnote: noteText,
            replacesectionnote: "true"
        });

        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/reviewofsystems`,
            {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body
            }
        );

        if (!response.ok) {
            throw new Error(`ROS failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating Review of Systems:", error.message);
        throw error;
    }
}


async function putAssessment(practiceId, encounterId, noteText) {
    try {
        const token = await getToken();

        const body = new URLSearchParams({
            assessmenttext: noteText,
            replacetext: "true"
        });

        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/assessment`,
            {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body
            }
        );

        if (!response.ok) {
            throw new Error(`Assessment failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating Assessment:", error.message);
        throw error;
    }
}


module.exports = { postVisitReason, putPhysicalExam, putHPI, putReviewOfSystems, putAssessment };