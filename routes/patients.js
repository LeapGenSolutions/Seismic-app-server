const express = require("express");
const router = express.Router();
const { fetchAllPatients, fetchPatientById } = require("../services/patientsService");

router.get("/", async (req, res) => {
  try {
    const items = await fetchAllPatients();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route to get patient by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const patient = await fetchPatientById(id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
