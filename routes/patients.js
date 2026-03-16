const express = require("express");
const router = express.Router();
const { fetchAllPatients, fetchPatientById, createPatient, fetchAllPatientsSeismic, fetchPatientByIdSeismic, createPatientSeismic, createPatientBoth } = require("../services/patientsService");

router.get("/", async (req, res) => {
  try {
    const { clinicName } = req.query;
    const items = await fetchAllPatients(clinicName);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Route for fetching all patients from Seismic backend
router.get("/seismic", async (req, res) => {
  try {
    const items = await fetchAllPatientsSeismic();
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

// Route to get patient by ID from Seismic backend
router.get("/seismic/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const patient = await fetchPatientByIdSeismic(id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/add/seismic", async (req, res) => {
  try {
    const data = req.body;
    const newPatient = await createPatientSeismic(data);
    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/add/chat-bot", async (req, res) => {
  try {
    const data = req.body;
    const newPatient = await createPatient(data);
    res.status(201).json(newPatient);
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/add", async (req, res) => {
  try {
    const data = req.body;
    const newPatient = await createPatientBoth(data);
    res.status(201).json(newPatient);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
