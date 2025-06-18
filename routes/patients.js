const express = require("express");
const router = express.Router();
const { fetchAllPatients } = require("../services/patientsService");

router.get("/", async (req, res) => {
  try {
    const items = await fetchAllPatients();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
