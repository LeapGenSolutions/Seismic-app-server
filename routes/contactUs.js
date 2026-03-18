const express = require("express");
const { postContactEmail } = require("../services/contactUsService");
const router = express.Router();

router.post("/:email/email", async (req, res) => {
  const { email } = req.params;
  const data = req.body;
  if (!email && !data) {
    return res.status(400).json({ error: "Email or data is required" });
  }
  try {
    const item = await postContactEmail(email, data);
    res.status(201).json(item);
  } catch (err) {
    res.status(403).json({ error: "Failed to create contact email" });
  }
});

module.exports = router;