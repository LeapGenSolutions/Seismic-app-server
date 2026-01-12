const express = require("express")
const { verifyNPI } = require("../services/npiVerificationService")

const router = express.Router()

router.post('/', async (req, res) => {
  const { npiNumber } = req.body;

  try {
    const result = await verifyNPI(npiNumber);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "NPI verification failed", message: err.message });
  }
});



module.exports =router