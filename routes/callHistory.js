const express = require("express");
const router = express.Router();
const {
  insertCallHistory,
  fetchCallHistoryFromEmail,
  fetchDoctorsFromCallHistory
} = require("../services/callHistoryService");

router.get("/doctors", async (req, res) => {
  try {
    const item = await fetchDoctorsFromCallHistory();
    res.json(item);
  } catch (err) {
    res.status(404).json({ error: "Item not found" });
  }
});

router.get("/:userID", async (req, res) => {
  const { userID } = req.params;
  try {
    const item = await fetchCallHistoryFromEmail(userID);
    res.json(item);
  } catch (err) {
    res.status(404).json({ error: "Item not found" });
  }
});

router.post("/:id", async (req, res) => {
  const { id } = req.params;
  const reqBody = req.body;
  let errorMsg = "";
  try {
    if (!reqBody.userID) {
      errorMsg = "UserID is mandatory";
    }
    await insertCallHistory(id, reqBody);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: errorMsg || "Failed to Insert into DB" });
  }
});

module.exports = router;
