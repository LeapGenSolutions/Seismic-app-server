const express = require("express");
const router = express.Router();
const { fetchSOAPByAppointment, patchSoapNotesByAppointment } = require("../services/soapService");

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
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to update SOAP notes" });
  }
});

module.exports = router;
