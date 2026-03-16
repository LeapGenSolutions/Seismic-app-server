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
        const objectiveMatch = noteText.match(/Objective -([\s\S]*?)(?=\n\nAssessment and Plan -)/);
        const assessmentPlanMatch = noteText.match(/Assessment and Plan -([\s\S]*?)(?=\r?\n\r?\n\$procedure_notes|\r?\n\$procedure_notes|$)/i);
        const sectionResults = {};

        const sectionPosts = [
            ["reason", reasonMatch, (sectionText) => postVisitReason(practiceId, encounterId, sectionText, token)],
            ["subjective", subjectiveMatch, (sectionText) => putHPI(practiceId, encounterId, sectionText, token)],
            ["ros", rosMatch, (sectionText) => putReviewOfSystems(practiceId, encounterId, sectionText, token)],
            ["objective", objectiveMatch, (sectionText) => putPhysicalExam(practiceId, encounterId, sectionText, token)],
            ["assessmentPlan", assessmentPlanMatch, (sectionText) => putAssessment(practiceId, encounterId, sectionText, token)],
        ];

        for (const [key, match, postSection] of sectionPosts) {
            if (!match) continue;

            try {
                let sectionText = match[1].trim();

                if (key === "objective") {
                    try {
                        const obj = JSON.parse(sectionText);
                        let formatted = "";

                        if (obj.vital_signs && Object.keys(obj.vital_signs).length) {
                            formatted += "Vital Signs:\n";
                            for (const [k, v] of Object.entries(obj.vital_signs)) {
                                formatted += `${k}: ${v}\n`;
                            }
                            formatted += "\n";
                        }

                        if (obj.body_measures && Object.keys(obj.body_measures).length) {
                            formatted += "Body Measures:\n";
                            for (const [k, v] of Object.entries(obj.body_measures)) {
                                formatted += `${k}: ${v}\n`;
                            }
                            formatted += "\n";
                        }

                        if (obj.physical_exams && Object.keys(obj.physical_exams).length) {
                            formatted += "Physical Exam:\n";
                            for (const [k, v] of Object.entries(obj.physical_exams)) {
                                formatted += `${k}: ${v}\n`;
                            }
                            formatted += "\n";
                        }

                        if (obj.laboratory_data?.length) {
                            formatted += "Laboratory Data:\n";
                            obj.laboratory_data.forEach(x => formatted += `- ${x}\n`);
                            formatted += "\n";
                        }

                        if (obj.imaging_studies?.length) {
                            formatted += "Imaging Studies:\n";
                            obj.imaging_studies.forEach(x => formatted += `- ${x}\n`);
                            formatted += "\n";
                        }

                        sectionText = formatted.trim();
                    } catch (e) {
                        console.warn("Objective is not valid JSON");
                    }
                }

                if (key === "assessmentPlan") {
                    try {
                        const obj = JSON.parse(sectionText);
                        let formatted = "";

                        if (obj.problems) {
                            obj.problems.forEach((p, i) => {
                                formatted += `Problem #${i + 1}: ${p.problem}\n`;
                                formatted += `Assessment: ${p.assessment}\n`;
                                formatted += `Plan: ${p.plan}\n\n`;
                            });
                        }

                        if (obj.follow_up) {
                            formatted += `Follow-up: ${obj.follow_up}`;
                        }

                        sectionText = formatted.trim();
                    } catch (e) {
                        console.warn("AssessmentPlan not JSON");
                    }
                }

                await postSection(sectionText);
                sectionResults[key] = true;
            } catch (error) {
                console.error(`Error posting ${key}:`, error.message);
                sectionResults[key] = false;
            }
        }

        return { section_results: sectionResults };
    } catch (error) {
        console.error("Error posting all sections:", error.message);
        throw error;
    }
}


module.exports = { postVisitReason, putPhysicalExam, putHPI, putReviewOfSystems, putAssessment, postAll, getToken};
