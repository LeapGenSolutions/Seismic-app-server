const express = require("express");
const { getVbcForPatient } = require("../services/VBCService");
const router = express.Router();

router.post("/:appointmentId", async (req, res) => {
    const patientData = req.body;
    if (!patientData) {
        return res.status(400).json({ error: "Patient data is required" });
    }
    try {
        const result = await getVbcForPatient(patientData);
        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching VBC for patient:", error);
        res.status(500).json({ error: "Failed to fetch VBC for patient" });
    }
});

module.exports = router;