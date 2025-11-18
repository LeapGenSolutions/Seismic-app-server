const express = require('express');
const router = express.Router();
const { createPostCallFeedback, fetchPostCallFeedbackByAppointment } = require('../services/postCallFeedbackService');

router.get("/:email/:appointmentId", async (req, res) => {
    const user_id = req.params.email;
    const appointmentId = req.params.appointmentId;
    if (!user_id || !appointmentId) {
        return res.status(400).json({ error: 'userID and appointmentId are required' });
    }
    try {
        const feedbackItem = await fetchPostCallFeedbackByAppointment(appointmentId, user_id);
        res.status(200).json(feedbackItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch post call feedback' });
    }
});

router.post('/:email/:appointmentId', async (req, res) => {
    const user_id = req.params.email;
    const appointmentId = req.params.appointmentId;
    const feedbackData = req.body;
    if (!user_id || !feedbackData) {
        return res.status(400).json({ error: 'userID and feedbackData are required' });
    }
    try {
        const createdItem = await createPostCallFeedback(user_id, appointmentId, feedbackData);
        res.status(200).json(createdItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create post call feedback' });
    }
});

module.exports = router;