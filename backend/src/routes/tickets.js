const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'tickets', searchable: ['title', 'description', 'customer_name'], filterable: ['status', 'category', 'priority'], label: 'ticket' });

// Get ticket by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create ticket
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, category, priority, customer_name, customer_email, status } = req.body;
    const result = await pool.query(
      `INSERT INTO tickets (title, description, category, priority, customer_name, customer_email, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, category, priority || 'medium', customer_name, customer_email, status || 'open', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating ticket:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update ticket
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, category, priority, customer_name, customer_email, status, assigned_to, resolution } = req.body;
    const result = await pool.query(
      `UPDATE tickets SET title = $1, description = $2, category = $3,
       priority = $4, customer_name = $5, customer_email = $6, status = $7, assigned_to = $8, resolution = $9, updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [title, description, category, priority, customer_name, customer_email, status, assigned_to, resolution, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete ticket
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Close ticket
router.post('/:id/close', authMiddleware, async (req, res) => {
  try {
    const { resolution } = req.body;
    const result = await pool.query(
      `UPDATE tickets SET status = 'closed', resolution = $1, closed_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [resolution, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error closing ticket:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI prioritize ticket
router.post('/:id/prioritize', authMiddleware, async (req, res) => {
  try {
    const ticketResult = await pool.query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketResult.rows[0];
    const analysis = await aiService.prioritizeTicket(ticket.title, ticket.description);

    await pool.query(
      'UPDATE tickets SET ai_analysis = $1, updated_at = NOW() WHERE id = $2',
      [analysis, req.params.id]
    );

    res.json({ analysis });
  } catch (error) {
    console.error('AI prioritization error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
