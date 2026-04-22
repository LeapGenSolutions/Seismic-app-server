const { client } = require("../cosmosClient");
require("dotenv").config();

const getCDSOrders = async (patientId, encounterId) => {
  try {
    const database = client.database(process.env.COSMOS_SEISMIC_ANALYSIS);
    const container = database.container("SOAP_Container");

    const querySpec = {
      query: "SELECT * FROM c WHERE CONTAINS(c.id, @encounterId)",
      parameters: [
        {
          name: "@encounterId",
          value: encounterId || ""
        }
      ]
    };

    const { resources } = await container.items
      .query(querySpec)
      .fetchAll();

    if (!resources || resources.length === 0) {
      return [];
    }

    const soapRecord = resources[0];
    const orders = soapRecord?.data?.orders || [];
    return orders.filter(order => !order.isPosted);

  } catch (error) {
    console.error("Error fetching CDS orders:", error);
    return [];
  }
};

module.exports = { getCDSOrders };