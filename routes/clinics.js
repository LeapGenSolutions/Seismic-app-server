const express = require("express");
const router = express.Router();
const { authenticateCIAM } = require("../middleware/ciamAuth");
const { searchClinics } = require("../services/clinicsService");

router.get("/", authenticateCIAM, async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    if (search.length < 2) {
      return res.json([]);
    }

    const clinics = await searchClinics(search);
    return res.json(clinics);
  } catch (error) {
    console.error("Clinic search error:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to search clinics",
    });
  }
});

module.exports = router;
