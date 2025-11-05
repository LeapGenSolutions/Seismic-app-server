const express = require("express");
const router = express.Router();
const { fetchEmotionalEmpathy, fetchLongitudinalSentiment, fetchSentimentAnalysis } = require("../services/EmotionalConnectService");
const { use } = require("react");

router.get("/emotional-empathy/:userId/:sessionId", async (req, res) => {
    try {
        const { userId, sessionId } = req.params;
        const items = await fetchEmotionalEmpathy(sessionId, userId);
        res.json(items);
    }
    catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/longitudinal-sentiment/:userId/:sessionID", async (req, res) => {
    try {
        const { userId, sessionID } = req.params;
        const items = await fetchLongitudinalSentiment(sessionID, userId);
        res.json(items);
    }
    catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/sentiment_analysis/:userId/:sessionID", async (req, res) => {
    try {
        const { userId, sessionID } = req.params;
        const items = await fetchSentimentAnalysis(sessionID, userId);
        res.json(items);
    }
    catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;