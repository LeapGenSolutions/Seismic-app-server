const express = require("express");
const router = express.Router();
const billingAccess = require("../middleware/billingAccess");
const { getBillingSummary, exportTransactionsCsv } = require("../services/reportService");

// ─── GET /api/reports/billing-summary?year=2026 ───────────────────────────────
router.get("/billing-summary", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const year = parseInt(req.query.year || new Date().getFullYear(), 10);
    const summary = await getBillingSummary(doctorId, year);
    res.json(summary);
  } catch (err) {
    console.error("GET /reports/billing-summary:", err);
    res.status(500).json({ error: "Failed to generate billing summary." });
  }
});

// ─── GET /api/reports/export?from=2026-01-01&to=2026-12-31 ───────────────────
router.get("/export", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { from, to, status } = req.query;
    const csv = await exportTransactionsCsv(doctorId, { from, to, status });

    const filename = `seismic-transactions-${doctorId}-${Date.now()}.csv`;
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    console.error("GET /reports/export:", err);
    res.status(500).json({ error: "Failed to export transactions." });
  }
});

module.exports = router;
