const express = require("express");
const router = express.Router();

const {
  postVisitReason,
  putPhysicalExam,
  putHPI,
  putReviewOfSystems,
  putAssessment,
  postAll,
  putPatientInstructions
} = require("../services/athenaService");
const { trackAppointmentAudit } = require("../services/telemetryService");

router.post("/:email/encounters/:appointmentId/visit-reason", async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { note, practiceID } = req.body;

    const result = await postVisitReason(
      practiceID,
      appointmentId,
      note
    );

    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "success",
      section: "visit-reason",
      appointment_id: appointmentId,
      performed_by: req.params.email
    });
    res.status(200).json(result);
  } catch (error) {
    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "failed",
      section: "visit-reason",
      appointment_id: req.params.appointmentId,
      performed_by: req.params.email,
      error_message: error.message
    });
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

    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "success",
      section: "physical-exam",
      appointment_id: appointmentId,
      performed_by: req.params.email
    });
    res.status(200).json(result);
  } catch (error) {
    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "failed",
      section: "physical-exam",
      appointment_id: req.params.appointmentId,
      performed_by: req.params.email,
      error_message: error.message
    });
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

    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "success",
      section: "hpi",
      appointment_id: appointmentId,
      performed_by: req.params.email
    });
    res.status(200).json(result);
  } catch (error) {
    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "failed",
      section: "hpi",
      appointment_id: req.params.appointmentId,
      performed_by: req.params.email,
      error_message: error.message
    });
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

    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "success",
      section: "review-of-systems",
      appointment_id: appointmentId,
      performed_by: req.params.email
    });
    res.status(200).json(result);
  } catch (error) {
    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "failed",
      section: "review-of-systems",
      appointment_id: req.params.appointmentId,
      performed_by: req.params.email,
      error_message: error.message
    });
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

    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "success",
      section: "assessment",
      appointment_id: appointmentId,
      performed_by: req.params.email
    });
    res.status(200).json(result);
  } catch (error) {
    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "failed",
      section: "assessment",
      appointment_id: req.params.appointmentId,
      performed_by: req.params.email,
      error_message: error.message
    });
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

    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "success",
      section: "all",
      appointment_id: appointmentId,
      performed_by: req.params.email
    });
    res.status(200).json(result);
  } catch (error) {
    trackAppointmentAudit("soap.audit", {
      action: "post_to_athena",
      status: "failed",
      section: "all",
      appointment_id: req.params.appointmentId,
      performed_by: req.params.email,
      error_message: error.message
    });
    res.status(500).json({ error: error.message });
  }
});

// post and update patient instructions/reccomendations.
router.put("/:email/encounter/:encounterId/post-recommendations", async(req,res) =>{
  try{
    const {email, encounterId} = req.params;
    const {patientId, patientinstructions, id} = req.body;
    if(!patientId || !patientinstructions || !id){
      return res.status(400).json({success: false, error: "Missing required fields: patientId, patientinstructions, and id are required."});
    }
    if(!encounterId){
      return res.status(400).json({success: false, error: "Missing required field: encounterId is required."});
    }
    const result = await putPatientInstructions(patientId, encounterId, patientinstructions, id);
    if(!result.success){
      return res.status(500).json({success: false, error: result.error || "Failed to update patient instructions."});
    }
    res.status(200).json({success: true, data: result.data});
  }catch(error){
    res.status(500).json({success: false, error: error.message});
  }
});

module.exports = router;
