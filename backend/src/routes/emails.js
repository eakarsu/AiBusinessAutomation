const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'emails', searchable: ['subject', 'from_address', 'to_address', 'body'], filterable: ['status', 'category', 'priority'], label: 'email' });

// Get email by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM emails WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching email:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create email
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { from_address, to_address, subject, body, category, priority, status } = req.body;
    const result = await pool.query(
      `INSERT INTO emails (from_address, to_address, subject, body, category, priority, status, received_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [from_address, to_address, subject, body, category || 'general', priority || 'medium', status || 'unread']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating email:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update email
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { from_address, to_address, subject, body, category, priority, status, assigned_to } = req.body;
    const result = await pool.query(
      `UPDATE emails SET from_address = $1, to_address = $2, subject = $3, body = $4,
       category = $5, priority = $6, status = $7, assigned_to = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [from_address, to_address, subject, body, category, priority, status, assigned_to, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating email:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete email
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM emails WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    res.json({ message: 'Email deleted successfully' });
  } catch (error) {
    console.error('Error deleting email:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI categorize email
router.post('/:id/categorize', authMiddleware, async (req, res) => {
  try {
    const emailResult = await pool.query('SELECT * FROM emails WHERE id = $1', [req.params.id]);
    if (emailResult.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }
    const email = emailResult.rows[0];
    const analysis = await aiService.categorizeEmail(email.subject, email.body);

    await pool.query(
      'UPDATE emails SET ai_analysis = $1, updated_at = NOW() WHERE id = $2',
      [analysis, req.params.id]
    );

    res.json({ analysis });
  } catch (error) {
    console.error('AI categorization error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
