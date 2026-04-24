const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'rpa_scripts', searchable: ['name', 'task_description'], filterable: ['status', 'platform', 'complexity'], label: 'RPA script' });

// Get single RPA script
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM rpa_scripts WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RPA script not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching RPA script:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new RPA script request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, task_description, platform, input_data, output_format, complexity } = req.body;
    const result = await pool.query(
      `INSERT INTO rpa_scripts (name, task_description, platform, input_data, output_format, complexity, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING *`,
      [name, task_description, platform, input_data, output_format, complexity || 'medium', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating RPA script:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update RPA script
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, task_description, platform, input_data, output_format, complexity, status } = req.body;
    const result = await pool.query(
      `UPDATE rpa_scripts SET name = $1, task_description = $2, platform = $3, input_data = $4,
       output_format = $5, complexity = $6, status = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [name, task_description, platform, input_data, output_format, complexity, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RPA script not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating RPA script:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete RPA script
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM rpa_scripts WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RPA script not found' });
    }
    res.json({ message: 'RPA script deleted successfully' });
  } catch (error) {
    console.error('Error deleting RPA script:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI: Generate RPA script
router.post('/:id/generate', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM rpa_scripts WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'RPA script not found' });
    }
    const script = result.rows[0];
    const generated = await aiService.generateRPAScript(
      script.name,
      script.task_description,
      script.platform,
      script.input_data,
      script.output_format
    );

    await pool.query(
      'UPDATE rpa_scripts SET generated_script = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [generated, 'generated', id]
    );

    res.json({ analysis: generated });
  } catch (error) {
    console.error('AI generation error:', error);
    res.status(500).json({ error: 'AI generation failed' });
  }
});

module.exports = router;
