const express = require("express");
const router = express.Router();
const { fetchAppointmentsByEmails, createAppointment, createBulkAppointments, deleteAppointment, updateAppointment } = require("../services/appointmentsService");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

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

router.post("/bulk/appointments", upload.single("file"), async (req, res) => {
  const data = JSON.parse(req.body.data)
  try{
    if(!req.file){
      return res.status(400).json({ error: "No file uploaded" });
    }
    const result = await createBulkAppointments(req.file, data);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:email/appointment/:id", async (req, res) => {
  try{
    const { email, id } = req.params;
    await deleteAppointment(email, id);
    res.status(200).json({ message: "Appointment deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:email/appointment/:id", async (req, res) => {
  try{
    const { email, id } = req.params;
    const data = req.body;
    const updatedAppointments = await updateAppointment(email, id, data);
    res.status(200).json(updatedAppointments);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});


module.exports = router;
