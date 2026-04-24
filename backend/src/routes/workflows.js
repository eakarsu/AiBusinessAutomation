const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'workflows', searchable: ['name', 'description'], filterable: ['status', 'trigger_type'], label: 'workflow' });

// Get workflow by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM workflows WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create workflow
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, trigger_type, steps, status } = req.body;
    const result = await pool.query(
      `INSERT INTO workflows (name, description, trigger_type, steps, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description, trigger_type, JSON.stringify(steps || []), status || 'draft', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update workflow
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description, trigger_type, steps, status } = req.body;
    const result = await pool.query(
      `UPDATE workflows SET name = $1, description = $2, trigger_type = $3,
       steps = $4, status = $5, updated_at = NOW() WHERE id = $6 RETURNING *`,
      [name, description, trigger_type, JSON.stringify(steps || []), status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete workflow
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM workflows WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI suggest workflow
router.post('/ai/suggest', authMiddleware, async (req, res) => {
  try {
    const { description } = req.body;
    const suggestion = await aiService.generateWorkflowSuggestion(description);
    res.json({ suggestion });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
