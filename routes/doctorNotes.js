const express = require('express');
const router = express.Router();
const { fetchDoctorNotesByAppointment, patchDoctorNotesByAppointment, createDoctorNotes } = require('../services/doctorNotesService');

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const partitionKey = req.query.userID;
    if (!partitionKey) {
        return res.status(400).json({ error: 'partitionKey query param is required' });
    }
    try {
        const items = await fetchDoctorNotesByAppointment(id, partitionKey);
        res.json(items);
    } catch (err) {
        res.status(404).json({ error: 'Item not found' });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await patchDoctorNotesByAppointment(id, req.body);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update doctor notes' });
    }
});

router.post("/:id", async (req, res) => {
    const { id } = req.params;
    const user_id = req.body.userID;
    const doctor_notes_title = req.body.title;
    const doctor_notes = req.body.content;
    console.log(user_id);
    
    const priority = req.body.priority;
    const tags = req.body.tags || [];
    if (!user_id || !doctor_notes) {
        return res.status(400).json({ error: 'userID, doctorNotes are required' });
    }
    try {
        const createdItem = await createDoctorNotes(id, 
            { user_id, doctor_notes, priority, doctor_notes_title, tags });
        res.status(200).json(createdItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to create doctor notes' });
    }
});

module.exports = router;