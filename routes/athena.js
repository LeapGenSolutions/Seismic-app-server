const express = require("express");
const router = express.Router();
const { postVisitReason, putPhysicalExam, putHPI, putReviewOfSystems, putAssessment } = require("../services/athenaService");

router.post("/:email/encounters/:appointmentId/visit-reason", async (req, res) => {
    try {
        const { email, appointmentId } = req.params;
        const data = req.body;
        const result = await postVisitReason(email, appointmentId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put("/:email/encounters/:appointmentId/physical-exam", async (req, res) => {
    try {
        const { email, appointmentId } = req.params;
        const data = req.body;
        const result = await putPhysicalExam(appointmentId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put("/:email/encounters/:appointmentId/hpi", async (req, res) => {
    try {
        const { email, appointmentId } = req.params;
        const data = req.body;
        const result = await putHPI(appointmentId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put("/:email/encounters/:appointmentId/review-of-systems", async (req, res) => {
    try {
        const { email, appointmentId } = req.params;
        const data = req.body;
        const result = await putReviewOfSystems(appointmentId, data);
        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put("/:email/encounters/:appointmentId/assessment", async (req, res) => {
    try {
        const { email, appointmentId } = req.params;
        const data = req.body;
        const result = await putAssessment(appointmentId, data);
        res.status(200).json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;