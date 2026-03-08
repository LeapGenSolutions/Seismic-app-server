const express = require("express");
const { postOrdersReferral, postOrdersVaccine, postOrdersProcedure, postOrdersPrescription, postOrdersPatientInfo, postOrdersOther, postOrdersLab, postOrdersImaging, postOrdersDME} = require("../services/ordersService");
const router = express.Router();

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



module.exports = router;