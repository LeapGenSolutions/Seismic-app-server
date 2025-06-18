const express = require("express");
const router = express.Router();
const { fetchSummaryOfSummaries } = require("../services/summaryService");

router.get("/:patientID", async (req, res) => {
  try {
    const { patientID } = req.params;
    const item = await fetchSummaryOfSummaries(patientID);
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch summary of summaries" });
  }
});

module.exports = router;
