const { getTransactionsContainer } = require("./billingCosmosClient");
const { createObjectCsvStringifier } = require("csv-writer");

async function listTransactions(doctorId, filters = {}) {
  const container = getTransactionsContainer();

  let query = "SELECT * FROM c WHERE c.doctorId = @doctorId";
  const parameters = [{ name: "@doctorId", value: doctorId }];

  if (filters.status) {
    query += " AND c.status = @status";
    parameters.push({ name: "@status", value: filters.status });
  }
  if (filters.from) {
    query += " AND c.createdAt >= @from";
    parameters.push({ name: "@from", value: filters.from });
  }
  if (filters.to) {
    query += " AND c.createdAt <= @to";
    parameters.push({ name: "@to", value: filters.to });
  }

  query += " ORDER BY c.createdAt DESC";

  const { resources } = await container.items
    .query({ query, parameters })
    .fetchAll();

  return resources;
}

async function getTransactionById(doctorId, txId) {
  const container = getTransactionsContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.doctorId = @doctorId AND c.id = @id",
      parameters: [
        { name: "@doctorId", value: doctorId },
        { name: "@id", value: txId },
      ],
    })
    .fetchAll();
  return resources[0] || null;
}

async function getBillingSummary(doctorId, year) {
  const transactions = await listTransactions(doctorId, {
    from: `${year}-01-01T00:00:00.000Z`,
    to: `${year}-12-31T23:59:59.999Z`,
    status: "succeeded",
  });

  const monthlySummary = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    monthName: new Date(year, i, 1).toLocaleString("en-US", { month: "long" }),
    total: 0,
    count: 0,
  }));

  let annualTotal = 0;

  for (const tx of transactions) {
    const month = new Date(tx.createdAt).getMonth();
    monthlySummary[month].total += tx.amount || 0;
    monthlySummary[month].count += 1;
    annualTotal += tx.amount || 0;
  }

  return {
    year,
    annualTotal: parseFloat(annualTotal.toFixed(2)),
    monthlySummary,
    transactionCount: transactions.length,
  };
}

async function exportTransactionsCsv(doctorId, filters = {}) {
  const transactions = await listTransactions(doctorId, filters);

  const stringifier = createObjectCsvStringifier({
    header: [
      { id: "createdAt", title: "Date" },
      { id: "transactionId", title: "Transaction ID" },
      { id: "subscriptionModality", title: "Subscription Type" },
      { id: "paymentMethodType", title: "Payment Method" },
      { id: "amount", title: "Amount (USD)" },
      { id: "status", title: "Status" },
      { id: "description", title: "Description" },
    ],
  });

  const csvHeader = stringifier.getHeaderString();
  const csvBody = stringifier.stringifyRecords(transactions);
  return csvHeader + csvBody;
}

async function saveTransaction(doctorId, transactionData) {
  const { v4: uuidv4 } = require("uuid");
  const container = getTransactionsContainer();
  const doc = {
    id: uuidv4(),
    doctorId,
    ...transactionData,
    createdAt: new Date().toISOString(),
  };
  const { resource } = await container.items.create(doc);
  return resource;
}

async function updateTransactionStatus(doctorId, transactionId, status, extra = {}) {
  const container = getTransactionsContainer();
  const { resources } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.doctorId = @doctorId AND c.transactionId = @txId",
      parameters: [
        { name: "@doctorId", value: doctorId },
        { name: "@txId", value: transactionId },
      ],
    })
    .fetchAll();

  if (!resources.length) return null;

  const tx = resources[0];
  const updated = { ...tx, status, ...extra };
  const { resource } = await container.item(tx.id, tx.doctorId).replace(updated);
  return resource;
}

module.exports = {
  listTransactions,
  getTransactionById,
  getBillingSummary,
  exportTransactionsCsv,
  saveTransaction,
  updateTransactionStatus,
};
