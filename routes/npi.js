const express = require("express")
const { verifyNPI } = require("../services/npiVerificationService")
const { checkNPIDuplicate } = require("../services/standaloneService")

const router = express.Router()

router.post('/', async (req, res) => {
  console.log('Received NPI verification request:', req.body);
  const { npiNumber } = req.body;

  try {
    const result = await verifyNPI(npiNumber);
    
   console.log('NPI verification result:', result);

    // Check if NPI is already used
    if (result.valid) {
      const npiExists = await checkNPIDuplicate(npiNumber);
      console.log(`NPI ${npiNumber} already exists:`, npiExists);
      
      if (npiExists) {
        return res.status(400).json({ error: "NPI already exists" });
      }
      result.alreadyUsed = npiExists;
    }
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "NPI verification failed", message: err.message });
  }
});



module.exports =router