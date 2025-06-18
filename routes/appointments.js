const express = require("express");
const router = express.Router();
const { fetchAppointmentsByEmail } = require("../services/appointmentsService");

router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const items = await fetchAppointmentsByEmail(email);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
