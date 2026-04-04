const express = require("express");
const router = express.Router();
const billingAccess = require("../middleware/billingAccess");
const { listTransactions, getTransactionById } = require("../services/reportService");
const { generateReceiptPDF } = require("../services/pdfService");

// ─── GET /api/transactions ────────────────────────────────────────────────────
router.get("/", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const { status, from, to } = req.query;
    const txs = await listTransactions(doctorId, { status, from, to });
    res.json(txs);
  } catch (err) {
    console.error("GET /transactions:", err);
    res.status(500).json({ error: "Failed to list transactions." });
  }
});

// ─── GET /api/transactions/:id ────────────────────────────────────────────────
router.get("/:id", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const tx = await getTransactionById(doctorId, req.params.id);
    if (!tx) return res.status(404).json({ error: "Transaction not found." });
    res.json(tx);
  } catch (err) {
    console.error("GET /transactions/:id:", err);
    res.status(500).json({ error: "Failed to get transaction." });
  }
});

// ─── GET /api/transactions/:id/receipt ───────────────────────────────────────
router.get("/:id/receipt", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const tx = await getTransactionById(doctorId, req.params.id);
    if (!tx) return res.status(404).json({ error: "Transaction not found." });

    const doctorName = `${req.userData.firstName || ""} ${req.userData.lastName || ""}`.trim();
    const pdfBuffer = await generateReceiptPDF(tx, doctorName);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${tx.transactionId || tx.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("GET /transactions/:id/receipt:", err);
    res.status(500).json({ error: "Failed to generate receipt." });
  }
});

module.exports = router;
