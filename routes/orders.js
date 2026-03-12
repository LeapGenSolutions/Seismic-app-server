const express = require("express");
const { postOrdersReferral, postOrdersVaccine, postOrdersProcedure, postOrdersPrescription, postOrdersPatientInfo, postOrdersOther, postOrdersLab, postOrdersImaging, postOrdersDME, postOrdersAll} = require("../services/ordersService");
const { patchSoapNotesByAppointment } = require("../services/soapService");
const router = express.Router();

router.patch("/:email/:id/update", async (req, res) => {
    const { id, email } = req.params;
    const { orders } = req.body;
    if (!orders || !Array.isArray(orders)) {
        return res.status(400).json({ message: "Orders must be provided as an array" });
    }
    try {
        updatedOrders = {
            orders: orders
        }
        const soapId = `${email}_${id}_soap`;
        await patchSoapNotesByAppointment(soapId, email, updatedOrders);
        return res.status(200).json({ message: "Orders updated successfully" });
    } catch (error) {
        console.error("Error updating SOAP notes:", error);
        return res.status(500).json({ message: "Failed to update SOAP notes" });
    }
});
// post orders

router.post("/:email/encounters/:encounterId/orders/imaging", async (req, res) => {
    const data = req.body;
    const { encounterId } = req.params;
    const practiceId = data.practiceId;
    try{
        const result  = await postOrdersImaging(practiceId, encounterId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/:email/encounters/:encounterId/orders/lab", async (req, res) => {
    const data = req.body;
    const { encounterId } = req.params;
    const practiceId = data.practiceId;
    try{
        const result  = await postOrdersLab(practiceId, encounterId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/:email/encounters/:encounterId/orders/procedure", async (req, res) => {
    const data = req.body;
    const { encounterId } = req.params;
    const practiceId = data.practiceId;
    try{
        const result  = await postOrdersProcedure(practiceId, encounterId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/:email/encounters/:encounterId/orders/other", async (req, res) => {
    const data = req.body;
    const { encounterId } = req.params;
    const practiceId = data.practiceId;
    try{
        const result  = await postOrdersOther(practiceId, encounterId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/:email/encounters/:encounterId/orders/patientinfo", async (req, res) => {
    const data = req.body;
    const { encounterId } = req.params;
    const practiceId = data.practiceId;
    try{
        const result  = await postOrdersPatientInfo(practiceId, encounterId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/:email/encounters/:encounterId/orders/prescription", async (req, res) => {
    const data = req.body;
    const { encounterId } = req.params;
    const practiceId = data.practiceId;
    try{
        const result  = await postOrdersPrescription(practiceId, encounterId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/:email/encounters/:encounterId/orders/referral", async (req, res) => {
    const data = req.body;
    const { encounterId } = req.params;
    const practiceId = data.practiceId;
    try{
        const result  = await postOrdersReferral(practiceId, encounterId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/:email/encounters/:encounterId/orders/vaccine", async (req, res) => {
    const data = req.body;
    const { encounterId } = req.params;
    const practiceId = data.practiceId;
    try{
        const result  = await postOrdersVaccine(practiceId, encounterId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/:email/encounters/:encounterId/orders/dme", async (req, res) => {
    const data = req.body;
    const { encounterId } = req.params;
    const practiceId = data.practiceId;
    try{
        const result  = await postOrdersDME(practiceId, encounterId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.post("/:email/encounters/:encounterId/orders/all", async (req, res) => {
    const data = req.body;
    const { encounterId } = req.params;
    const practiceId = data.practiceId;
    const orders = data.orders;
    try{
        const result = await postOrdersAll(practiceId, encounterId, orders);
        res.status(200).json(result);
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
});



module.exports = router;