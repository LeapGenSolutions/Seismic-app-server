const express = require("express");
const router = express.Router();
const { fetchSOAPByAppointment, patchSoapNotesByAppointment } = require("../services/soapService");
const { trackAppointmentAudit } = require("../services/telemetryService");

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const partitionKey = req.query.userID;
  if (!partitionKey) {
    return res.status(400).json({ error: "partitionKey query param is required" });
  }
  try {
    const item = await fetchSOAPByAppointment(id, partitionKey);
    res.json(item);
  } catch (err) {
    res.status(404).json({ error: "Item not found" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const partitionKey = req.query.username;
    const updatedSoapNotes = req.body.soap_notes;
    if (!partitionKey) {
      return res.status(400).json({ error: "partitionKey query param is required" });
    }
    if (!updatedSoapNotes) {
      return res.status(400).json({ error: "soap_notes in body is required" });
    }
    await patchSoapNotesByAppointment(id, partitionKey, updatedSoapNotes);
    trackAppointmentAudit("soap.audit", {
      action: "save",
      status: "success",
      appointment_id: id,
      performed_by: partitionKey
    });
    res.status(200).json({ success: true });
  } catch (error) {
    trackAppointmentAudit("soap.audit", {
      action: "save",
      status: "failed",
      appointment_id: req.params.id,
      performed_by: req.query.username,
      error_message: error.message || "Failed to update SOAP notes"
    });
    res.status(500).json({ error: "Failed to update SOAP notes" });
  }
});

module.exports = router;
