const fs = require("fs/promises");
const path = require("path");
const { BlobServiceClient } = require("@azure/storage-blob");

const DEFAULT_BAA_CONTAINER = "signed-baa-agreements";
const DEFAULT_AGREEMENT_DOCX_PATH = path.join(
  __dirname,
  "..",
  "assets",
  "legal",
  "SeismicConnectTermsAgreement.docx"
);

function sanitizeBlobSegment(value = "unknown") {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || "unknown";
}

function escapePdfText(value = "") {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapLine(line, maxChars = 95) {
  const words = String(line || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildPdfLines({ agreementText, signerName, signedAt, version, email, userId }) {
  const headerLines = [
    "Seismic Connect Terms and Agreement",
    `BAA Version: ${version}`,
    `Signed By: ${signerName}`,
    `Signed At: ${new Date(signedAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC`,
    `Email: ${email || ""}`,
    `User ID: ${userId || ""}`,
    "",
    "Agreement Text",
    "",
  ];

  const agreementLines = String(agreementText || "")
    .split(/\r?\n/)
    .flatMap((line) => wrapLine(line, 92));

  const signatureLines = [
    "",
    "Electronic Signature",
    `Signer Name: ${signerName}`,
    `Timestamp: ${signedAt}`,
    `Version: ${version}`,
  ];

  return [...headerLines, ...agreementLines, ...signatureLines];
}

function makePageContent(lines) {
  const commands = ["BT", "/F1 10 Tf", "50 752 Td", "14 TL"];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("T*");
    commands.push(`(${escapePdfText(line)}) Tj`);
  });
  commands.push("ET");
  return commands.join("\n");
}

function generateSignedBaaPdfBuffer(details) {
  const allLines = buildPdfLines(details);
  const linesPerPage = 50;
  const pages = [];

  for (let index = 0; index < allLines.length; index += linesPerPage) {
    pages.push(allLines.slice(index, index + linesPerPage));
  }

  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalogRef = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesRef = addObject("");
  const fontRef = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageRefs = [];

  pages.forEach((pageLines) => {
    const content = makePageContent(pageLines);
    const contentRef = addObject(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
    const pageRef = addObject(
      `<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRef} 0 R >> >> /Contents ${contentRef} 0 R >>`
    );
    pageRefs.push(pageRef);
  });

  objects[pagesRef - 1] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

async function uploadSignedBaaPdf({ user, baaSignature }) {
  const connectionString =
    process.env.BAA_BLOB_CONNECTION_STRING || process.env.RECORDINGS_BLOB_CONNECTION_STRING;
  const containerName = process.env.BAA_BLOB_CONTAINER || DEFAULT_BAA_CONTAINER;

  if (!connectionString) {
    console.warn("BAA PDF upload skipped: no BAA_BLOB_CONNECTION_STRING or RECORDINGS_BLOB_CONNECTION_STRING configured.");
    return null;
  }

  const signedAt = baaSignature.signedAt || new Date().toISOString();
  const version = baaSignature.baaVersion || baaSignature.version || process.env.CURRENT_BAA_VERSION || "v1.0";
  const userId = user.userId || user.doctor_id || user.id || user.email;
  const email = user.primaryEmail || user.email || user.doctor_email;
  const signerName = baaSignature.signerName || "";
  const sourceDocumentPath = process.env.BAA_AGREEMENT_DOCX_PATH || DEFAULT_AGREEMENT_DOCX_PATH;
  const sourceDocumentBuffer = await fs.readFile(sourceDocumentPath);
  const signatureCertificate = {
    agreementTitle: baaSignature.agreementTitle || "Seismic Connect Terms and Agreement",
    agreementVersion: version,
    sourceDocumentFileName: path.basename(sourceDocumentPath),
    signed: baaSignature.signed === true,
    signerName,
    manualSignature: baaSignature.manualSignature || "",
    signedAt,
    email: email || "",
    userId: userId || "",
  };
  const signatureCertificateBuffer = Buffer.from(
    JSON.stringify(signatureCertificate, null, 2),
    "utf8"
  );

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  await containerClient.createIfNotExists();

  const timestamp = signedAt.replace(/[:.]/g, "-");
  const baseBlobPath = `${sanitizeBlobSegment(email || userId)}/${sanitizeBlobSegment(version)}/${timestamp}`;
  const agreementBlobName = `${baseBlobPath}/SeismicConnectTermsAgreement.docx`;
  const signatureBlobName = `${baseBlobPath}/signature-certificate.json`;
  const agreementBlobClient = containerClient.getBlockBlobClient(agreementBlobName);
  const signatureBlobClient = containerClient.getBlockBlobClient(signatureBlobName);

  await agreementBlobClient.uploadData(sourceDocumentBuffer, {
    blobHTTPHeaders: {
      blobContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      blobContentDisposition: `attachment; filename="SeismicConnectTermsAgreement-${sanitizeBlobSegment(version)}.docx"`,
    },
    metadata: {
      baaVersion: sanitizeBlobSegment(version),
      signerName: sanitizeBlobSegment(signerName),
      userId: sanitizeBlobSegment(userId),
    },
  });

  await signatureBlobClient.uploadData(signatureCertificateBuffer, {
    blobHTTPHeaders: {
      blobContentType: "application/json",
      blobContentDisposition: `attachment; filename="seismic-baa-signature-${sanitizeBlobSegment(version)}.json"`,
    },
    metadata: {
      baaVersion: sanitizeBlobSegment(version),
      signerName: sanitizeBlobSegment(signerName),
      userId: sanitizeBlobSegment(userId),
    },
  });

  return {
    blobName: agreementBlobName,
    containerName,
    url: agreementBlobClient.url,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: sourceDocumentBuffer.length,
    agreementBlobName,
    agreementUrl: agreementBlobClient.url,
    agreementContentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    agreementSizeBytes: sourceDocumentBuffer.length,
    signatureBlobName,
    signatureUrl: signatureBlobClient.url,
    signatureContentType: "application/json",
    signatureSizeBytes: signatureCertificateBuffer.length,
  };
}

module.exports = {
  generateSignedBaaPdfBuffer,
  uploadSignedBaaPdf,
};
