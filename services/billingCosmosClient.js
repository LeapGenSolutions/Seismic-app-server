const { CosmosClient } = require("@azure/cosmos");
require("dotenv").config();

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY,
});

const db = () => client.database(process.env.COSMOS_BILLING_DATABASE);

const getSubscriptionsContainer = () => db().container("subscriptions");
const getPaymentMethodsContainer = () => db().container("payment_methods");
const getTransactionsContainer = () => db().container("transactions");
const getInvoicesContainer = () => db().container("invoices");
const getBillingAuditLogsContainer = () => db().container("billing_audit_logs");

module.exports = {
  getSubscriptionsContainer,
  getPaymentMethodsContainer,
  getTransactionsContainer,
  getInvoicesContainer,
  getBillingAuditLogsContainer,
};
