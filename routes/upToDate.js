const express = require("express");
const router = express.Router();

const { fetchUpToDateInfo, upToDateRecommendation } = require("../services/upToDateService");

router.get("/", async (req, res) => {
    const keyword = req.body.keyword;
    try {
        const data = await fetchUpToDateInfo(keyword);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/recommendation/:appId/:userId", async (req, res) => {
    const { appId, userId } = req.params;
    try {
        const data = await upToDateRecommendation(appId, userId);
        res.status(200).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;