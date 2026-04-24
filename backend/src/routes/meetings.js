const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'meetings', searchable: ['title', 'description', 'location'], filterable: ['status', 'meeting_type'], label: 'meeting' });

// Get meeting by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create meeting
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, meeting_date, duration, participants, location, meeting_type, status } = req.body;
    const result = await pool.query(
      `INSERT INTO meetings (title, description, meeting_date, duration, participants, location, meeting_type, status, organizer)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, description, meeting_date, duration, JSON.stringify(participants || []), location, meeting_type, status || 'scheduled', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update meeting
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, meeting_date, duration, participants, location, meeting_type, status, agenda, notes } = req.body;
    const result = await pool.query(
      `UPDATE meetings SET title = $1, description = $2, meeting_date = $3,
       duration = $4, participants = $5, location = $6, meeting_type = $7, status = $8, agenda = $9, notes = $10, updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [title, description, meeting_date, duration, JSON.stringify(participants || []), location, meeting_type, status, agenda, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating meeting:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete meeting
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM meetings WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('Error deleting meeting:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI generate agenda
router.post('/:id/generate-agenda', authMiddleware, async (req, res) => {
  try {
    const meetingResult = await pool.query('SELECT * FROM meetings WHERE id = $1', [req.params.id]);
    if (meetingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    const meeting = meetingResult.rows[0];
    const participants = typeof meeting.participants === 'string'
      ? JSON.parse(meeting.participants)
      : meeting.participants;
    const agenda = await aiService.generateMeetingAgenda(
      meeting.title,
      participants.join(', '),
      meeting.duration
    );

    await pool.query(
      'UPDATE meetings SET agenda = $1, updated_at = NOW() WHERE id = $2',
      [agenda, req.params.id]
    );

    res.json({ agenda });
  } catch (error) {
    console.error('AI agenda generation error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
