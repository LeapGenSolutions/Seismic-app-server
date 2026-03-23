const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);

const getUsersContainer = () => database.container(process.env.COSMOS_USERS_CONTAINER || "doctors");
const getRolesContainer = () => database.container(process.env.COSMOS_ROLES_CONTAINER || "roles");


module.exports = {
  client,
  database,
  getUsersContainer,
  getRolesContainer,
};
