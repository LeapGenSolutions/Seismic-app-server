const express = require("express");
const router = express.Router();
const billingAccess = require("../middleware/billingAccess");
const {
  listInvoices,
  getInvoiceById,
  getInvoicePDFBuffer,
  resendInvoice,
} = require("../services/invoiceService");

// ─── GET /api/invoices ────────────────────────────────────────────────────────
router.get("/", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const offset = parseInt(req.query.offset || "0", 10);
    const limit = parseInt(req.query.limit || "20", 10);
    const invoices = await listInvoices(doctorId, offset, limit);
    res.json(invoices);
  } catch (err) {
    console.error("GET /invoices:", err);
    res.status(500).json({ error: "Failed to list invoices." });
  }
});

// ─── GET /api/invoices/:id ────────────────────────────────────────────────────
router.get("/:id", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const invoice = await getInvoiceById(doctorId, req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });
    res.json(invoice);
  } catch (err) {
    console.error("GET /invoices/:id:", err);
    res.status(500).json({ error: "Failed to get invoice." });
  }
});

// ─── GET /api/invoices/:id/download ──────────────────────────────────────────
router.get("/:id/download", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    const invoice = await getInvoiceById(doctorId, req.params.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found." });

    const pdfBuffer = await getInvoicePDFBuffer(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error("GET /invoices/:id/download:", err);
    res.status(500).json({ error: "Failed to download invoice." });
  }
});

// ─── POST /api/invoices/:id/send ──────────────────────────────────────────────
router.post("/:id/send", billingAccess, async (req, res) => {
  try {
    const doctorId = req.userData.email;
    await resendInvoice(doctorId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("POST /invoices/:id/send:", err);
    res.status(500).json({ error: err.message || "Failed to send invoice." });
  }
});

module.exports = router;
