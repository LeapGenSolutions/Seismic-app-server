const { CosmosClient } = require("@azure/cosmos");
const { getToken } = require("./athenaService");
require("dotenv").config();

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const client = new CosmosClient({ endpoint, key });

async function fetchOrdersdiagnoses(practiceId, encounterId, snomedcode, token) {
    try{
        const body = new URLSearchParams({
            snomedcode
        });
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
            if(response.status === 400 && errorText.error === `Diagnosis with snomed code ${snomedcode} already present in encounter.`) {
                return { status: 200, message: "Diagnosis already exists for this encounter" };
            }
            return { status : response.status ,message: `Failed to fetch diagnoses: ${errorText.error}` };
        }

        return await response.json();
    } catch (error) {
        console.error("Error updating diagnoses:", error.message);
        throw error;
    }   
}

async function getEncounterId(practiceId, appointmentId, username, date){
    const database = client.database(process.env.COSMOS_DATABASE);
    const container = database.container("seismic_appointments");
    const normalizedDoctorEmail = (username || '').toLowerCase();
    const id = appointmentId.replace(/\D/g, "");
    try{
        token = await getToken();
        const response = await fetch(
            `${process.env.ATHENA_BASE_URL}/v1/${practiceId}/appointments/${id}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );
        if (!response.ok) {
            const errorText = await response.json();
            return { status : response.status ,message: `Failed to fetch Appointment: ${errorText.error}` };
        }
        const result = await response.json();
        if(result[0].encounterid === undefined || result[0].encounterid === ""){
            return { status : 404, message: `Encounter ID Not Found for the given appointment` };
        }
        const quesry = {
            query: `SELECT * FROM c WHERE c.id = @id`,
            parameters: [{ name: "@id", value: date }]
        };
        const { resources: results } = await container.items.query(quesry).fetchAll();
        if(results.length === 0){
            return { status : 404, message: `Appointment Not Found` };
        }
        const appointments = results[0].data;
        const currentAppointment = appointments.find(app => app.id === appointmentId && app.doctor_email === normalizedDoctorEmail);
        const updatedAppointment = {
            ...currentAppointment,
            athena_encounter_id : result[0].encounterid,
            athena_patient_id : result[0].patientid || currentAppointment.athena_patient_id,
            athena_provider_id : result[0].providerid || currentAppointment.athena_provider_id,
            athena_departmentid : result[0].departmentid || currentAppointment.athena_departmentid
        }
        const updatedAppointments = appointments.map(app => {
            if(app.id === appointmentId && app.doctor_email === normalizedDoctorEmail){
                return { ...app, ...updatedAppointment };
            }
            return app;
        });
      const updateResponse = await container.items.upsert({ id: date, data: updatedAppointments });
      if(updateResponse.statusCode >= 400){
        const errorText = await updateResponse.json();
        console.log(errorText);
        return { status : updateResponse.statusCode ,message: `Failed to fetch EncouterId: ${errorText.error}` };
      }
      return { status : 200, encounterId: result[0].encounterid, message: "Encounter ID fetched and appointment updated successfully" };
    } catch (error) {
        console.error("Error fetching encounter ID:", error.message);
        throw error;

    }
}

async function postOrdersImaging(practiceId, encounterId, data, appointmentId, username) {
    try{
        token = await getToken();
        const res = await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code, token);
        if(res.status !== 200){
            return res;
        }
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
            const errorText = await response.json();
            return { status : response.status ,message: `Failed to fetch Imaging orders: ${errorText.error}` };
        }
        await isPosted(appointmentId, username, data.selected_order_id, data);
        return await response.json();
    } catch (error) {
        console.error("Error updating imaging orders:", error.message);
        throw error;
    }
};

async function postOrdersLab(practiceId, encounterId, data, appointmentId, username) {
    try{
        token = await getToken();
        const res = await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code, token);
        if(res.status !== 200){
            return res;
        }
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
            const errorText = await response.json();
            return { status : response.status ,message: `Failed to fetch Lab orders: ${errorText.error}` };
        }
        await isPosted(appointmentId, username, data.selected_order_id, data);
        return await response.json();
    } catch (error) {
        console.error("Error updating lab orders:", error.message);
        throw error;
    }
};

async function postOrdersOther(practiceId, encounterId, data, appointmentId, username) {
    try{
        token = await getToken();
        const res = await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code, token);
        if(res.status !== 200){
            return res;
        }
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
            const errorText = await response.json();
            return { status : response.status ,message: `Failed to fetch Other orders: ${errorText.error}` };
        }
        await isPosted(appointmentId, username, data.selected_order_id, data);
        return await response.json();
    } catch (error) {
        console.error("Error updating other orders:", error.message);
        throw error;
    }
};

async function postOrdersPatientInfo(practiceId, encounterId, data, appointmentId, username) {
    try{
        token = await getToken();
        const res = await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code, token);
        if(res.status !== 200){
            return res;
        }
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
            const errorText = await response.json();
            return { status : response.status ,message: `Failed to fetch Patient info orders: ${errorText.error}` };
        }
        await isPosted(appointmentId, username, data.selected_order_id, data);
        return await response.json();
    } catch (error) {
        console.error("Error updating patient info orders:", error.message);
        throw error;
    }
};

async function postOrdersPrescription(practiceId, encounterId, data, appointmentId, username) {
    try{
        token = await getToken();
        const res = await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code, token);
        if(res.status !== 200){
            return res;
        }
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
            const errorText = await response.json();
            return { status : response.status ,message: `Failed to fetch Prescription orders: ${errorText.error}` };
        }
        await isPosted(appointmentId, username, data.selected_order_id, data);
        return await response.json();
    } catch (error) {
        console.error("Error updating prescription orders:", error.message);
        throw error;
    }
};

async function postOrdersProcedure(practiceId, encounterId, data, appointmentId, username) {
    try{
        token = await getToken();
        const res = await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code, token);
        if(res.status !== 200){
            return res;
        }
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
            const errorText = await response.json();
            return { status : response.status ,message: `Failed to fetch Procedure orders: ${errorText.error}` };
        }
        await isPosted(appointmentId, username, data.selected_order_id, data);
        return await response.json();
    } catch (error) {
        console.error("Error updating procedure orders:", error.message);
        throw error;
    }
};

async function postOrdersReferral(practiceId, encounterId, data, appointmentId, username) {
    try{
        token = await getToken();
        const res = await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code, token);
        if(res.status !== 200){
            return res;
        }
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
            const errorText = await response.json();
            return { status : response.status ,message: `Failed to fetch Referral orders: ${errorText.error}` };
        }
        await isPosted(appointmentId, username, data.selected_order_id, data);
        return await response.json();
    } catch (error) {
        console.error("Error updating referral orders:", error.message);
        throw error;
    }
};

async function postOrdersVaccine(practiceId, encounterId, data, appointmentId, username) {
    try{
        token = await getToken();
        const res = await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code, token);
        if(res.status !== 200){
            return res;
        }
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
            const errorText = await response.json();
            return { status : response.status ,message: `Failed to fetch Vaccine orders: ${errorText.error}` };
        }
        await isPosted(appointmentId, username, data.selected_order_id, data);
        return await response.json();
    } catch (error) {
        console.error("Error updating vaccine orders:", error.message);
        throw error;
    }
};

async function postOrdersDME(practiceId, encounterId, data, appointmentId, username) {
    try{
        token = await getToken();
        const res = await fetchOrdersdiagnoses(practiceId, encounterId, data.snomed_code, token);
        if(res.status !== 200){
            return res;
        }
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
            const errorText = await response.json();
            return { status : response.status ,message: `Failed to fetch DME orders: ${errorText.error}` };
        }
        await isPosted(appointmentId, username, data.selected_order_id, data);
        return await response.json();
    } catch (error) {
        console.error("Error updating DME orders:", error.message);
        throw error;
    }
};

async function isPosted(appointmentId, username, orderId, data){
    try{
        const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
        const container = database.container("SOAP_Container");
        const { resource }  = await container.item(`${username}_${appointmentId}_soap`, username).read();
        const orders = resource.data.orders || [];
        const order = orders.find(o => o.selected_order_id === orderId);
        const updatedOrder = { ...data, practiceId : undefined, isPosted: true };
        const updatedOrders = orders.map(o => o.selected_order_id === orderId ? updatedOrder : o);
        const updatedData = { ...resource.data, orders: updatedOrders };
        const updatedItem = { ...resource, data: updatedData };
        await container.item(`${username}_${appointmentId}_soap`, username).replace(updatedItem);
    }catch (err) {
        console.error(err);
        throw new Error({ error: "Failed to update order status" });
    }
}


module.exports = {
    getEncounterId,
    postOrdersReferral,
    postOrdersVaccine,
    postOrdersProcedure,
    postOrdersPrescription,
    postOrdersPatientInfo,
    postOrdersOther,
    postOrdersLab,
    postOrdersImaging,
    postOrdersDME
};
