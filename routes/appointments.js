const express = require("express");
const router = express.Router();
const { fetchAppointmentsByEmails, fetchAppointmentsByClinic, createAppointment, createBulkAppointments, deleteAppointment, updateAppointment, cancelAppointment } = require("../services/appointmentsService");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

function getPerformedBy(req, fallbackEmail) {
  return (
    req.userData?.email ||
    req.user?.email ||
    req.user?.preferred_username ||
    req.user?.upn ||
    req.headers["x-user-email"] ||
    req.query.username ||
    req.body?.userId ||
    fallbackEmail
  );
}

router.get("/all", async (req, res) => {
  try {
    const { clinicName } = req.query;

    if (!clinicName) {
      return res.status(400).json({ error: "clinicName query parameter is required" });
    }
    const items = await fetchAppointmentsByClinic(clinicName, {
      performedBy: getPerformedBy(req, "unknown"),
      route: req.originalUrl,
      method: req.method
    });
    res.json(items);
  } catch (err) {
    console.error("Error fetching appointments by clinic:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
    const newAppointment = await createAppointment(email, data, {
      performedBy: getPerformedBy(req, email),
      route: req.originalUrl,
      method: req.method
    });
    res.status(201).json(newAppointment);
  } catch (err) {
    console.error("Error creating appointment:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bulk/appointments", upload.single("file"), async (req, res) => {
  const data = JSON.parse(req.body.data);
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const result = await createBulkAppointments(req.file, data);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:email/appointment/:id", async (req, res) => {
  try {
    const { email, id } = req.params;
    const date = req.body.appointment_date;
    await deleteAppointment(email, id, date, {
      performedBy: getPerformedBy(req, email),
      route: req.originalUrl,
      method: req.method
    });
    res.status(200).json({ message: "Appointment deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:email/cancel/:id", async (req, res) => {
  try {
    const { email, id } = req.params;
    const reason = req.body.reason;
    const date = req.body.appointment_date;
    await cancelAppointment(email, id, reason, date, {
      performedBy: getPerformedBy(req, email),
      route: req.originalUrl,
      method: req.method
    });
    res.status(200).json({ message: "Appointment cancel successfully" });
  } catch (err) {
    console.error("Error canceling appointment:", err);
    res.status(500).json({ error: "internal server error" });
  }
})

router.patch("/:email/appointment/:id", async (req, res) => {
  try {
    const { email, id } = req.params;
    const data = req.body;
    const updatedAppointments = await updateAppointment(email, id, data, {
      performedBy: getPerformedBy(req, email),
      route: req.originalUrl,
      method: req.method
    });
    res.status(200).json(updatedAppointments);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});


module.exports = router;
