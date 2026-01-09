const { CosmosClient } = require("@azure/cosmos");

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

const database = client.database(process.env.COSMOS_DATABASE);

const getUsersContainer = () => database.container(process.env.COSMOS_USERS_CONTAINER || "doctors");


module.exports = {
  client,
  database,
  getUsersContainer,
};