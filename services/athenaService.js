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


async function postVisitReason(practiceId, encounterId, noteText, athenaToken = null) {
    const token = athenaToken || await getToken();
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


async function putPhysicalExam(practiceId, encounterId, note, athenaToken = null) {
    const token = athenaToken || await getToken();

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


async function putHPI(practiceId, encounterId, noteText, athenaToken = null) {
    try {
        const token = athenaToken || await getToken();

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


async function putReviewOfSystems(practiceId, encounterId, noteText, athenaToken = null) {
    try {
        const token = athenaToken || await getToken();

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


async function putAssessment(practiceId, encounterId, noteText, athenaToken = null) {
    try {
        const token = athenaToken || await getToken();

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

async function postAll(practiceId, encounterId, noteText) {
    try {
        const token = await getToken();

        const reasonMatch = noteText.match(/Reason for Visit -([\s\S]*?)(?=\n\nSubjective -)/);
        const subjectiveMatch = noteText.match(/Subjective -([\s\S]*?)(?=\n\nFamily history discussed)/);
        const rosMatch = noteText.match(/Review of Systems(?:\s*\(ROS\))?:\s*([\s\S]*?)(?=\n\nObjective -)/);
        // check
        const objectiveMatch = noteText.match(/Objective -([\s\S]*?)(?=\n\nAssessment and Plan -)/);
        const assessmentPlanMatch = noteText.match(/Assessment and Plan -([\s\S]*?)(?=\r?\n\r?\n\$procedure_notes|\r?\n\$procedure_notes|$)/i);
        const reasonMarchResponse = reasonMatch ? await postVisitReason(practiceId, encounterId, reasonMatch[1].trim(), token) : null;
        const subjectiveResponse = subjectiveMatch ? await putHPI(practiceId, encounterId, subjectiveMatch[1].trim(), token) : null;
        const rosResponse = rosMatch ? await putReviewOfSystems(practiceId, encounterId, rosMatch[1].trim(), token) : null;
        const objectiveResponse = objectiveMatch ? await putPhysicalExam(practiceId, encounterId, objectiveMatch[1].trim(), token) : null;
        const assessmentPlanResponse = assessmentPlanMatch ? await putAssessment(practiceId, encounterId, assessmentPlanMatch[1].trim(), token) : null;
        const data = {
            reason: reasonMarchResponse.success,
            subjective: false,
            ros: rosResponse.success,
            objective: objectiveResponse.success,
            assessmentPlan: assessmentPlanResponse.success
        }
        return data;
    } catch (error) {
        console.error("Error posting all sections:", error.message);
    }
}


module.exports = { postVisitReason, putPhysicalExam, putHPI, putReviewOfSystems, putAssessment, postAll};