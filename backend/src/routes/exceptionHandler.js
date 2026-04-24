const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'automation_exceptions', searchable: ['name', 'error_message', 'source_system'], filterable: ['status', 'exception_type', 'severity'], label: 'exception' });

// Get single exception
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM automation_exceptions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exception not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching exception:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new exception
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, exception_type, error_message, source_system, stack_trace, severity, impact } = req.body;
    const result = await pool.query(
      `INSERT INTO automation_exceptions (name, exception_type, error_message, source_system, stack_trace, severity, impact, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', $8) RETURNING *`,
      [name, exception_type, error_message, source_system, stack_trace, severity || 'medium', impact, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating exception:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update exception
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, exception_type, error_message, source_system, stack_trace, severity, impact, status } = req.body;
    const result = await pool.query(
      `UPDATE automation_exceptions SET name = $1, exception_type = $2, error_message = $3, source_system = $4,
       stack_trace = $5, severity = $6, impact = $7, status = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 RETURNING *`,
      [name, exception_type, error_message, source_system, stack_trace, severity, impact, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exception not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating exception:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete exception
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM automation_exceptions WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exception not found' });
    }
    res.json({ message: 'Exception deleted successfully' });
  } catch (error) {
    console.error('Error deleting exception:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI: Analyze and resolve exception
router.post('/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM automation_exceptions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Exception not found' });
    }
    const exception = result.rows[0];
    const resolution = await aiService.resolveException(
      exception.name,
      exception.exception_type,
      exception.error_message,
      exception.source_system,
      exception.stack_trace
    );

    await pool.query(
      'UPDATE automation_exceptions SET ai_resolution = $1, status = $2, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [resolution, 'resolved', id]
    );

    res.json({ analysis: resolution });
  } catch (error) {
    console.error('AI resolution error:', error);
    res.status(500).json({ error: 'AI resolution failed' });
  }
});

module.exports = router;
