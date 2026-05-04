const express = require("express");
const router = express.Router();
const multer = require("multer");
const { updateDoctorPersonalization } = require("../services/personalizationService");

router.put("/:doctorId", async(req,res) => {
    try{
        const { doctorId } = req.params;
        const personalizationData = req.body;
        if(!doctorId || !personalizationData){
            return res.status(400).json({ error: "DoctorId or Personalization data are required" })
        }
        const result = await updateDoctorPersonalization(doctorId, personalizationData);
        return res.status(200).json(result);
    } catch (err) {
        console.log("Error while updating data: " + err);
        return res.status(500).json({ error: err.message })
    }
});

module.exports = router;