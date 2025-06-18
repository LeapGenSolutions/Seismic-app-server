const express = require("express");
const router = express.Router();
const { fetchClustersByAppointment } = require("../services/clustersService");

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  const partitionKey = req.query.username;
  if (!partitionKey) {
    return res.status(400).json({ error: "partitionKey query param is required" });
  }
  try {
    const item = await fetchClustersByAppointment(id, partitionKey);
    res.json(item);
  } catch (err) {
    res.status(404).json({ error: "Item not found" });
  }
});

module.exports = router;
