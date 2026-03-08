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
    const raw = req.body && req.body.soap_notes;

    if (!partitionKey) {
      return res.status(400).json({ error: "partitionKey query param is required" });
    }
    if (!raw || typeof raw !== "string") {
      return res.status(400).json({ error: "soap_notes in body is required and must be a string" });
    }

    const extractSection = (text, marker) => {
      const re = new RegExp(`\\${marker}\\s*-\\s*([\\s\\S]*?)(?=(\\$soap_notes\\s*-|\\$procedure_notes\\s*-|\\$orders\\s*-|$))`, "i");
      const m = text.match(re);
      return m ? m[1].trim() : "";
    };

    const extractOrdersJson = (text) => {
      const ordersMarker = text.search(/\$orders\s*-/i);
      if (ordersMarker === -1) return null;
      const braceStart = text.indexOf("{", ordersMarker);
      if (braceStart === -1) return null;
      let i = braceStart;
      let depth = 0;
      for (; i < text.length; i++) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") {
          depth--;
          if (depth === 0) {
            const jsonStr = text.slice(braceStart, i + 1);
            try {
              return JSON.parse(jsonStr);
            } catch (e) {
              return null;
            }
          }
        }
      }
      return null;
    };

    const soapNotesSection = extractSection(raw, "$soap_notes");
    const procedureNotesSection = extractSection(raw, "$procedure_notes");
    const ordersObj = extractOrdersJson(raw);

    // Normalize orders into an array. incoming payload may be { orders: [...], confirmed: true }
    let ordersArray = null;
    if (ordersObj) {
      if (Array.isArray(ordersObj)) ordersArray = ordersObj;
      else if (Array.isArray(ordersObj.orders)) ordersArray = ordersObj.orders;
      else if (ordersObj.orders && typeof ordersObj.orders === 'object') ordersArray = [ordersObj.orders];
      else ordersArray = null;
    }

    const updatedSoap = {
      soapNotes: soapNotesSection || null,
      procedureNotes: procedureNotesSection || null,
      orders: ordersArray
    };

    await patchSoapNotesByAppointment(id, partitionKey, updatedSoap);
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
