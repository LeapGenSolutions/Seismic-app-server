const express = require("express");
const router = express.Router();

const {
  postVisitReason,
  putPhysicalExam,
  putHPI,
  putReviewOfSystems,
  putAssessment,
  postAll
} = require("../services/athenaService");



router.post("/:email/encounters/:appointmentId/visit-reason", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { note, practiceID } = req.body;

    const result = await postVisitReason(
      practiceID,
      appointmentId,
      note
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:email/encounters/:appointmentId/physical-exam", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { note, practiceID } = req.body;

    const result = await putPhysicalExam(
      practiceID,
      appointmentId,
      note
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:email/encounters/:appointmentId/hpi", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { note, practiceID } = req.body;

    const result = await putHPI(
      practiceID,
      appointmentId,
      note
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:email/encounters/:appointmentId/review-of-systems", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { note, practiceID } = req.body;

    const result = await putReviewOfSystems(
      practiceID,
      appointmentId,
      note
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put("/:email/encounters/:appointmentId/assessment", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { note, practiceID } = req.body;
    
    const result = await putAssessment(
      practiceID,
      appointmentId,
      note
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:email/encounters/:appointmentId/all", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { note, practiceID } = req.body;

    const result = await postAll(
      practiceID,
      appointmentId,
      note
    );

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
