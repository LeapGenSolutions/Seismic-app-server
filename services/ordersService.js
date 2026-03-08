const { CosmosClient } = require("@azure/cosmos");
const { getToken } = require("./athenaService");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchOrdersdiagnoses(practiceId, encounterId, snomedcode) {
    try{
        const token = await getToken();
        const body = new URLSearchParams({
            snomedcode
        });
        console.log("Fetching diagnoses with body:", body.toString(), practiceId, encounterId);
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/diagnoses`,
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
            const errorText = await response.json();
            if(response.status === 400 && errorText.detailedmessage === "Diagnosis with same snomed code already present in encounter.") {
                return { message: "Diagnosis with same snomed code already present in encounter." };
            }
            throw new Error(`Diagnoses update failed: ${errorText.error}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating diagnoses:", error.message);
        throw error;
    }   
}

async function postOrdersImaging(practiceId, encounterId, data) {
    try{
        const token = await getToken();
        await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code);
        const body = new URLSearchParams({
            diagnosissnomedcode : data.snomed_code,
            ordertypeid : data.selected_order_id,
            providernote : ""
        });
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/orders/imaging`,
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
            throw new Error(`Imaging orders failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating imaging orders:", error.message);
        throw error;
    }
};

async function postOrdersLab(practiceId, encounterId, data) {
    try{
        const token = await getToken();
        await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code);
        const body = new URLSearchParams({
            diagnosissnomedcode : data.snomed_code,
            ordertypeid : data.selected_order_id,
            providernote : ""
        });
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/orders/lab`,
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
            throw new Error(`Lab orders failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating lab orders:", error.message);
        throw error;
    }
};

async function postOrdersOther(practiceId, encounterId, data) {
    try{
        const token = await getToken();
        await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code);
        const body = new URLSearchParams({
            diagnosissnomedcode : data.snomed_code,
            ordertypeid : data.selected_order_id,
            providernote : ""
        });
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/orders/other`,
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
            throw new Error(`Other orders failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating other orders:", error.message);
        throw error;
    }
};

async function postOrdersPatientInfo(practiceId, encounterId, data) {
    try{
        const token = await getToken();
        await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code);
        const body = new URLSearchParams({
            diagnosissnomedcode : data.snomed_code,
            ordertypeid : data.selected_order_id,
            providernote : ""
        });
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/orders/patientinfo`,
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
            throw new Error(`Patient info orders failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating patient info orders:", error.message);
        throw error;
    }
};

async function postOrdersPrescription(practiceId, encounterId, data) {
    try{
        const token = await getToken();
        await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code);
        const body = new URLSearchParams({
            diagnosissnomedcode : data.snomed_code,
            ordertypeid : data.selected_order_id,
            providernote : ""
        });
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/orders/prescription`,
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
            throw new Error(`Prescription orders failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating prescription orders:", error.message);
        throw error;
    }
};

async function postOrdersProcedure(practiceId, encounterId, data) {
    try{
        const token = await getToken();
        await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code);
        const body = new URLSearchParams({
            diagnosissnomedcode : data.snomed_code,
            ordertypeid : data.selected_order_id,
            providernote : ""
        });
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/orders/procedure`,
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
            throw new Error(`Procedure orders failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating procedure orders:", error.message);
        throw error;
    }
};

async function postOrdersReferral(practiceId, encounterId, data) {
    try{
        const token = await getToken();
        await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code);
        const body = new URLSearchParams({
            diagnosissnomedcode : data.snomed_code,
            ordertypeid : data.selected_order_id,
            providernote : ""
        });
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/orders/referral`,
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
            throw new Error(`Referral orders failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating referral orders:", error.message);
        throw error;
    }
};

async function postOrdersVaccine(practiceId, encounterId, data) {
    try{
        const token = await getToken();
        await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code);
        const body = new URLSearchParams({
            diagnosissnomedcode : data.snomed_code,
            ordertypeid : data.selected_order_id,
            providernote : ""
        });
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/orders/vaccine`,
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
            throw new Error(`Vaccine orders failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating vaccine orders:", error.message);
        throw error;
    }
};

async function postOrdersDME(practiceId, encounterId, data) {
    try{
        const token = await getToken();
        await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code);
        const body = new URLSearchParams({
            diagnosissnomedcode : data.snomed_code,
            ordertypeid : data.selected_order_id,
            providernote : ""
        });
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/chart/encounter/${encounterId}/orders/dme`,
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
            throw new Error(`DME orders failed: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating DME orders:", error.message);
        throw error;
    }
};


module.exports = { 
    patchOrdersByAppointment,
    postOrdersReferral,
    postOrdersVaccine,
    postOrdersProcedure,
    postOrdersPrescription,
    postOrdersPatientInfo,
    postOrdersOther,
    postOrdersLab,
    postOrdersImaging,
    postOrdersDME,
};