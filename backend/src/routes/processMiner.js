const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'process_mining', searchable: ['name', 'description'], filterable: ['status', 'process_type', 'department', 'complexity'], label: 'process' });

// Get single process mining analysis
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM process_mining WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching process:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new process mining analysis
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, process_type, event_log, department, complexity } = req.body;
    const result = await pool.query(
      `INSERT INTO process_mining (name, description, process_type, event_log, department, complexity, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING *`,
      [name, description, process_type, event_log, department, complexity || 'medium', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating process:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update process mining analysis
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, process_type, event_log, department, complexity, status } = req.body;
    const result = await pool.query(
      `UPDATE process_mining SET name = $1, description = $2, process_type = $3, event_log = $4,
       department = $5, complexity = $6, status = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [name, description, process_type, event_log, department, complexity, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating process:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete process mining analysis
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM process_mining WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process not found' });
    }
    res.json({ message: 'Process deleted successfully' });
  } catch (error) {
    console.error('Error deleting process:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI: Analyze process
router.post('/:id/analyze', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM process_mining WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Process not found' });
    }
    const process = result.rows[0];
    const analysis = await aiService.analyzeProcess(process.name, process.description, process.event_log);

    await pool.query(
      'UPDATE process_mining SET ai_analysis = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [analysis, 'analyzed', id]
    );

    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI analysis failed' });
  }
});

module.exports = router;
