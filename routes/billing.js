const express = require("express");
const router = express.Router();
const { fetchBillingByAppointment, patchBillingByAppointment } = require("../services/billingService");

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const partitionKey = req.query.userID;
  if (!partitionKey) {
    return res.status(400).json({ error: "partitionKey query param is required" });
  }
  try {
    const item = await fetchBillingByAppointment(id, partitionKey);
    res.json(item);
  } catch (err) {
    res.status(404).json({ error: "Item not found" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await patchBillingByAppointment(id, req.query.username, req.body);
    res.status(200).json({ success: true , result : result});
  } catch (error) {
    console.error("Error updating billing codes:", error);
    res.status(500).json({ error: "Failed to update billing codes" });
  }
});

module.exports = router;

