const express = require("express");
const router = express.Router();

/**
 * CDS Hooks Discovery Endpoint
 * URL: GET /cds-services
 */
router.get("/", (req, res) => {
  res.json({
    services: [
      {
        hook: "patient-view",
        id: "seismic-patient-view",
        title: "Seismic Clinical Suggestions",
        description:
          "Returns Seismic AI-generated clinical suggestions for the selected patient.",
        prefetch: {}
      }
    ]
  });
});

/**
 * Some simulators may call POST /cds-services directly.
 */
router.post("/", (req, res) => {
  res.json({
    cards: [
      {
        summary: "Seismic CDS Hooks service is reachable",
        indicator: "info",
        detail:
          "The Seismic backend successfully received a CDS Hooks request and returned a valid card.",
        source: {
          label: "Seismic Connect"
        }
      }
    ]
  });
});

/**
 * Patient-view hook endpoint
 * URL: POST /cds-services/seismic-patient-view
 */
router.post("/seismic-patient-view", (req, res) => {
  const patientId = req.body?.context?.patientId || "unknown patient";

  res.json({
    cards: [
      {
        summary: "Seismic AI clinical suggestion available",
        indicator: "info",
        detail: `Seismic has generated clinical documentation suggestions for patient ${patientId}. Please review the AI-generated note, vitals, diagnosis, and possible order recommendations before finalizing.`,
        source: {
          label: "Seismic Connect"
        },
        links: [
          {
            label: "Open Seismic Connect",
            url: "https://dev.seismicconnect.com",
            type: "absolute"
          }
        ]
      }
    ]
  });
});

/**
 * Optional order endpoint for future testing.
 * Simulator may not fully support order-sign, but this helps keep the route ready.
 */
router.post("/seismic-orders", (req, res) => {
  res.json({
    cards: [
      {
        summary: "Seismic suggested orders available",
        indicator: "info",
        detail:
          "Based on the clinical conversation, Seismic suggests reviewing possible labs, medications, or imaging orders. Final order placement must be reviewed and signed by the clinician.",
        source: {
          label: "Seismic Connect"
        }
      }
    ]
  });
});

module.exports = router;