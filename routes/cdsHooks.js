const express = require("express");
const router = express.Router();
const { getCDSOrders } = require("../services/cdsHooksService");

// Discovery endpoint — Epic calls this first
router.get("/", (req, res) => {
  res.json({
    services: [
      {
        hook: "order-sign",
        id: "seismic-orders",
        title: "Seismic Post-Call Order Suggestions",
        description: "Returns AI-generated order suggestions from Seismic"
      }
    ]
  });
});

// Hook handler — Epic calls this when doctor signs orders
router.post("/seismic-orders", async (req, res) => {
  try {
    const { context } = req.body;
    const patientId = context?.patientId || "";
    const encounterId = context?.encounterId || "";

    const orders = await getCDSOrders(patientId, encounterId);

    if (!orders || orders.length === 0) {
      return res.json({ cards: [] });
    }

    const cards = orders.map(order => ({
      summary: `${order.type || "Order"}: ${order.clinical_content || order.name}`,
      indicator: "info",
      source: { label: "Seismic Connect" },
      selectionBehavior: "at-most-one",
      suggestions: [
        {
          label: `Add ${order.name || order.clinical_content}`,
          actions: [
            {
              type: "create",
              description: `Create order for ${order.name || order.clinical_content}`,
              resource: {
                resourceType:
                  order.type === "Lab" ? "ServiceRequest" :
                  order.type === "Imaging" ? "ServiceRequest" :
                  order.type === "Prescription" ? "MedicationRequest" :
                  "ServiceRequest",
                status: "draft",
                intent: "proposal",
                subject: { reference: `Patient/${patientId}` },
                code: { text: order.name || order.clinical_content }
              }
            }
          ]
        }
      ]
    }));

    res.json({ cards });

  } catch (error) {
    console.error("CDS Hooks error:", error);
    res.json({ cards: [] });
  }
});

module.exports = router;