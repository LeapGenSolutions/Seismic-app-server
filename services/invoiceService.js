const { v4: uuidv4 } = require("uuid");
const { getInvoicesContainer, getTransactionsContainer } = require("./billingCosmosClient");
const { generateInvoicePDF } = require("./pdfService");
const { sendInvoiceEmail, sendPaymentSuccess } = require("./emailService");
const { storageContainerClient } = require("../blobClient");
require("dotenv").config();

let invoiceCounter = Date.now(); // simple incrementing number; replace with DB counter if needed

function nextInvoiceNumber() {
  invoiceCounter++;
  const year = new Date().getFullYear();
  return `INV-${year}-${String(invoiceCounter).slice(-6).padStart(6, "0")}`;
}

async function createInvoice(doctorId, doctorData, subscription, transaction, lineItems) {
  const container = getInvoicesContainer();

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const tax = 0; // extend here when tax logic is needed
  const total = subtotal + tax;
  const invoiceNumber = nextInvoiceNumber();

  const doc = {
    id: uuidv4(),
    doctorId,
    doctorName: doctorData?.doctorName || `${doctorData?.firstName || ""} ${doctorData?.lastName || ""}`.trim(),
    npiNumber: doctorData?.npiNumber || null,
    invoiceNumber,
    subscriptionModality: subscription?.modality || null,
    periodStart: subscription?.currentPeriodStart || null,
    periodEnd: subscription?.currentPeriodEnd || null,
    lineItems,
    subtotal,
    tax,
    total,
    transactionId: transaction?.transactionId || null,
    paymentMethodType: transaction?.paymentMethodType || null,
    paymentMethodLast4: transaction?.paymentMethodLast4 || null,
    paymentMethodBrand: transaction?.paymentMethodBrand || null,
    status: "paid",
    pdfUrl: null,
    createdAt: new Date().toISOString(),
  };

  // Generate PDF
  try {
    const pdfBuffer = await generateInvoicePDF(doc);

    // Upload to Blob Storage
    const blobName = `${doctorId}/invoices/${invoiceNumber}.pdf`;
    const blobClient = storageContainerClient.getBlockBlobClient(blobName);
    await blobClient.uploadData(pdfBuffer, {
      blobHTTPHeaders: { blobContentType: "application/pdf" },
    });
    doc.pdfUrl = blobClient.url;

    // Save to Cosmos
    const { resource } = await container.items.create(doc);

    // Email with PDF attached
    await sendPaymentSuccess(doctorId, pdfBuffer, invoiceNumber);

    return resource;
  } catch (err) {
    console.error("Invoice generation error:", err.message);
    // Save without PDF on error
    const { resource } = await container.items.create(doc);
    return resource;
  }
}

async function listInvoices(doctorId, offset = 0, limit = 20) {
  const container = getInvoicesContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.doctorId = @doctorId ORDER BY c.createdAt DESC OFFSET @offset LIMIT @limit",
      parameters: [
        { name: "@doctorId", value: doctorId },
        { name: "@offset", value: offset },
        { name: "@limit", value: limit },
      ],
    })
    .fetchAll();
  return resources;
}

async function getInvoiceById(doctorId, invoiceId) {
  const container = getInvoicesContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.doctorId = @doctorId AND c.id = @id",
      parameters: [
        { name: "@doctorId", value: doctorId },
        { name: "@id", value: invoiceId },
      ],
    })
    .fetchAll();
  return resources[0] || null;
}

async function getInvoicePDFBuffer(invoice) {
  // Try fetching from Blob Storage first
  if (invoice.pdfUrl) {
    try {
      const blobName = `${invoice.doctorId}/invoices/${invoice.invoiceNumber}.pdf`;
      const blobClient = storageContainerClient.getBlockBlobClient(blobName);
      const download = await blobClient.download(0);
      const chunks = [];
      for await (const chunk of download.readableStreamBody) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } catch (_) {
      // Fall through to regenerate
    }
  }

  // Regenerate on the fly
  return generateInvoicePDF(invoice);
}

async function resendInvoice(doctorId, invoiceId) {
  const invoice = await getInvoiceById(doctorId, invoiceId);
  if (!invoice) throw new Error("Invoice not found.");

  const pdfBuffer = await getInvoicePDFBuffer(invoice);
  await sendInvoiceEmail(doctorId, pdfBuffer, invoice.invoiceNumber);
}

module.exports = {
  createInvoice,
  listInvoices,
  getInvoiceById,
  getInvoicePDFBuffer,
  resendInvoice,
};
