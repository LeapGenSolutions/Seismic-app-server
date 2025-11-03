const express = require("express");
const router = express.Router();
const { fetchAppointmentsByEmails, createAppointment } = require("../services/appointmentsService");

router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const items = await fetchAppointmentsByEmails(email.split(","));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:email/custom/appointment", async (req, res) => {
  try {
    const { email } = req.params;
    const data = req.body;
    const newAppointment = await createAppointment(email, data);
    res.status(201).json(newAppointment);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
