const express = require("express");
const { postOrdersReferral, postOrdersVaccine, postOrdersProcedure, postOrdersPrescription, postOrdersPatientInfo, postOrdersOther, postOrdersLab, postOrdersImaging, postOrdersDME, getEncounterId} = require("../services/ordersService");
const router = express.Router();

router.get("/:email/encounters/:appointmentId/encounterId", async (req, res) => {
    const { email, appointmentId } = req.params;
    const practiceId = req.body.practiceId;
    const date = req.body.date;
    if(appointmentId === undefined || !email || practiceId === undefined){
        return res.status(400).json({success: false, message: "Missing required fields" });
    }
    try{
        const result = await getEncounterId(practiceId, appointmentId, email, date);
        return res.status(result.status).json({success : result.status === 200 ? true : false, message : result.message, encounterId: result.encounterId});
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// post orders

router.post("/:email/encounters/:appointmentId/:encounterId/orders/imaging", async (req, res) => {
    const data = req.body;
    const { encounterId, appointmentId, email } = req.params;
    const practiceId = data.practiceId;
    if(!data.selected_order_id || !data.snomed_code || encounterId === undefined || appointmentId === undefined || !email || !practiceId){
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    try{
        const result  = await postOrdersImaging(practiceId, encounterId, data, appointmentId, email);
        return res.status(result.status).json({success : result.status === 200 ? true : false, message : result.message});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:email/encounters/:appointmentId/:encounterId/orders/lab", async (req, res) => {
    const data = req.body;
    const { encounterId, appointmentId, email } = req.params;
    const practiceId = data.practiceId;
    if(!data.selected_order_id || !data.snomed_code || encounterId === undefined || appointmentId === undefined || !email || !practiceId){
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    try{
        const result  = await postOrdersLab(practiceId, encounterId, data, appointmentId, email);
        return res.status(result.status).json({success : result.status === 200 ? true : false, message : result.message});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:email/encounters/:appointmentId/:encounterId/orders/procedure", async (req, res) => {
    const data = req.body;
    const { encounterId, appointmentId, email } = req.params;
    const practiceId = data.practiceId;
    if(!data.selected_order_id || !data.snomed_code || encounterId === undefined || appointmentId === undefined || !email || !practiceId){
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    try{
        const result  = await postOrdersProcedure(practiceId, encounterId, data, appointmentId, email);
        return res.status(result.status).json({success : result.status === 200 ? true : false, message : result.message});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:email/encounters/:appointmentId/:encounterId/orders/other", async (req, res) => {
    const data = req.body;
    const { encounterId, appointmentId, email } = req.params;
    const practiceId = data.practiceId;
    if(!data.selected_order_id || !data.snomed_code || encounterId === undefined || appointmentId === undefined || !email || !practiceId){
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    try{
        const result  = await postOrdersOther(practiceId, encounterId, data, appointmentId, email);
        return res.status(result.status).json({success : result.status === 200 ? true : false, message : result.message});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:email/encounters/:appointmentId/:encounterId/orders/patientinfo", async (req, res) => {
    const data = req.body;
    const { encounterId, appointmentId, email } = req.params;
    const practiceId = data.practiceId;
    if(!data.selected_order_id || !data.snomed_code || encounterId === undefined || appointmentId === undefined || !email || !practiceId){
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    try{
        const result  = await postOrdersPatientInfo(practiceId, encounterId, data, appointmentId, email);
        return res.status(result.status).json({success : result.status === 200 ? true : false, message : result.message});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:email/encounters/:appointmentId/:encounterId/orders/prescription", async (req, res) => {
    const data = req.body;
    const { encounterId, appointmentId, email } = req.params;
    const practiceId = data.practiceId;
    if(!data.selected_order_id || !data.snomed_code || encounterId === undefined || appointmentId === undefined || !email || !practiceId){
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    try{
        const result  = await postOrdersPrescription(practiceId, encounterId, data, appointmentId, email);
        return res.status(result.status).json({success : result.status === 200 ? true : false, message : result.message});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:email/encounters/:appointmentId/:encounterId/orders/referral", async (req, res) => {
    const data = req.body;
    const { encounterId, appointmentId, email } = req.params;
    const practiceId = data.practiceId;
    if(!data.selected_order_id || !data.snomed_code || encounterId === undefined || appointmentId === undefined || !email || !practiceId){
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    try{
        const result  = await postOrdersReferral(practiceId, encounterId, data, appointmentId, email);
        return res.status(result.status).json({success : result.status === 200 ? true : false, message : result.message});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:email/encounters/:appointmentId/:encounterId/orders/vaccine", async (req, res) => {
    const data = req.body;
    const { encounterId, appointmentId, email } = req.params;
    const practiceId = data.practiceId;
    if(!data.selected_order_id || !data.snomed_code || encounterId === undefined || appointmentId === undefined || !email || !practiceId){
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    try{
        const result  = await postOrdersVaccine(practiceId, encounterId, data, appointmentId, email);
        return res.status(result.status).json({success : result.status === 200 ? true : false, message : result.message});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:email/encounters/:appointmentId/:encounterId/orders/dme", async (req, res) => {
    const data = req.body;
    const { encounterId, appointmentId, email } = req.params;
    const practiceId = data.practiceId;
    if(!data.selected_order_id || !data.snomed_code || encounterId === undefined || appointmentId === undefined || !email || !practiceId){
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    try{
        const result  = await postOrdersDME(practiceId, encounterId, data, appointmentId, email);
        return res.status(result.status).json({success : result.status === 200 ? true : false, message : result.message});
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


module.exports = router;