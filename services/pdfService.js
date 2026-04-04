const PDFDocument = require("pdfkit");

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount) {
  return `$${parseFloat(amount || 0).toFixed(2)}`;
}

// Returns a Buffer of the generated PDF
function generateInvoicePDF(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // ─── Header ────────────────────────────────────────────────────────────
    doc.fontSize(24).font("Helvetica-Bold").text("SEISMIC", 50, 50);
    doc.fontSize(10).font("Helvetica").fillColor("#666666")
      .text("Healthcare Intelligence Platform", 50, 80);

    doc.fillColor("#000000");
    doc.fontSize(18).font("Helvetica-Bold").text("INVOICE", 400, 50, { align: "right" });
    doc.fontSize(10).font("Helvetica")
      .text(`Invoice #: ${invoice.invoiceNumber}`, { align: "right" })
      .text(`Date: ${formatDate(invoice.createdAt)}`, { align: "right" });

    // ─── Divider ───────────────────────────────────────────────────────────
    doc.moveTo(50, 115).lineTo(560, 115).strokeColor("#cccccc").stroke();

    // ─── Bill To ───────────────────────────────────────────────────────────
    doc.moveDown(1);
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333").text("BILL TO", 50, 130);
    doc.fontSize(11).font("Helvetica").fillColor("#000000")
      .text(invoice.doctorName || invoice.doctorId, 50, 145)
      .text(`NPI: ${invoice.npiNumber || "N/A"}`)
      .text(invoice.doctorId);

    // ─── Subscription Info ─────────────────────────────────────────────────
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333").text("SUBSCRIPTION", 350, 130);
    doc.fontSize(11).font("Helvetica").fillColor("#000000")
      .text(`Type: ${(invoice.subscriptionModality || "").replace("_", " ").toUpperCase()}`, 350, 145)
      .text(`Period: ${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`, 350);

    // ─── Line Items Table ──────────────────────────────────────────────────
    const tableTop = 240;
    doc.moveTo(50, tableTop).lineTo(560, tableTop).strokeColor("#333333").lineWidth(1).stroke();

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333")
      .text("DESCRIPTION", 50, tableTop + 8)
      .text("AMOUNT", 460, tableTop + 8, { width: 100, align: "right" });

    doc.moveTo(50, tableTop + 24).lineTo(560, tableTop + 24).strokeColor("#cccccc").stroke();

    let y = tableTop + 34;
    for (const item of invoice.lineItems || []) {
      doc.fontSize(10).font("Helvetica").fillColor("#000000")
        .text(item.description, 50, y)
        .text(formatCurrency(item.amount), 460, y, { width: 100, align: "right" });
      y += 20;
    }

    // ─── Totals ────────────────────────────────────────────────────────────
    doc.moveTo(350, y + 5).lineTo(560, y + 5).strokeColor("#cccccc").stroke();
    y += 15;

    doc.fontSize(10).font("Helvetica").fillColor("#000000")
      .text("Subtotal", 350, y)
      .text(formatCurrency(invoice.subtotal), 460, y, { width: 100, align: "right" });
    y += 18;

    doc.text("Tax", 350, y).text(formatCurrency(invoice.tax || 0), 460, y, { width: 100, align: "right" });
    y += 18;

    doc.moveTo(350, y).lineTo(560, y).strokeColor("#333333").stroke();
    y += 8;

    doc.fontSize(12).font("Helvetica-Bold")
      .text("TOTAL", 350, y)
      .text(formatCurrency(invoice.total), 460, y, { width: 100, align: "right" });

    // ─── Payment Info ──────────────────────────────────────────────────────
    y += 40;
    doc.fontSize(10).font("Helvetica-Bold").fillColor("#333333").text("PAYMENT DETAILS", 50, y);
    y += 15;
    doc.fontSize(10).font("Helvetica").fillColor("#000000");

    const paymentMethod = invoice.paymentMethodLast4
      ? `${(invoice.paymentMethodBrand || "Card").charAt(0).toUpperCase() + (invoice.paymentMethodBrand || "Card").slice(1)} ending in ${invoice.paymentMethodLast4}`
      : invoice.paymentMethodType === "venmo" ? "Venmo" : "N/A";

    doc.text(`Payment Method: ${paymentMethod}`, 50, y);
    y += 15;
    doc.text(`Transaction ID: ${invoice.transactionId || "N/A"}`, 50, y);
    y += 15;
    doc.text(`Status: ${(invoice.status || "").toUpperCase()}`, 50, y);

    // ─── Footer ────────────────────────────────────────────────────────────
    doc.fontSize(9).fillColor("#999999")
      .text("Thank you for using SEISMIC.", 50, 700, { align: "center", width: 510 })
      .text("For billing questions, contact billing@seismichealth.com", { align: "center", width: 510 });

    doc.end();
  });
}

function generateReceiptPDF(transaction, doctorName) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "LETTER" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(24).font("Helvetica-Bold").text("SEISMIC", 50, 50);
    doc.fontSize(16).font("Helvetica-Bold").text("Payment Receipt", 50, 90);

    doc.moveTo(50, 115).lineTo(560, 115).strokeColor("#cccccc").stroke();

    doc.fontSize(10).font("Helvetica").fillColor("#000000")
      .text(`Date: ${formatDate(transaction.createdAt)}`, 50, 130)
      .text(`Receipt for: ${doctorName || transaction.doctorId}`)
      .text(`Transaction ID: ${transaction.transactionId}`)
      .text(`Description: ${transaction.description}`)
      .text(`Amount: ${formatCurrency(transaction.amount)}`)
      .text(`Status: ${(transaction.status || "").toUpperCase()}`);

    const paymentMethod = transaction.paymentMethodLast4
      ? `Card ending in ${transaction.paymentMethodLast4}`
      : transaction.paymentMethodType === "venmo" ? "Venmo" : "N/A";

    doc.text(`Payment Method: ${paymentMethod}`);

    doc.fontSize(9).fillColor("#999999")
      .text("SEISMIC Healthcare Intelligence Platform", 50, 700, { align: "center", width: 510 })
      .text("billing@seismichealth.com", { align: "center", width: 510 });

    doc.end();
  });
}

module.exports = { generateInvoicePDF, generateReceiptPDF };
