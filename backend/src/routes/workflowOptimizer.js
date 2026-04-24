const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'workflow_optimizations', searchable: ['name', 'workflow_description', 'bottlenecks'], filterable: ['status', 'priority'], label: 'optimization' });

// Get single optimization
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM workflow_optimizations WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Optimization not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching optimization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new optimization request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, workflow_description, current_steps, bottlenecks, goals, priority } = req.body;
    const result = await pool.query(
      `INSERT INTO workflow_optimizations (name, workflow_description, current_steps, bottlenecks, goals, priority, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING *`,
      [name, workflow_description, current_steps, bottlenecks, goals, priority || 'medium', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating optimization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update optimization
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, workflow_description, current_steps, bottlenecks, goals, priority, status } = req.body;
    const result = await pool.query(
      `UPDATE workflow_optimizations SET name = $1, workflow_description = $2, current_steps = $3,
       bottlenecks = $4, goals = $5, priority = $6, status = $7, updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [name, workflow_description, current_steps, bottlenecks, goals, priority, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Optimization not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating optimization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete optimization
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM workflow_optimizations WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Optimization not found' });
    }
    res.json({ message: 'Optimization deleted successfully' });
  } catch (error) {
    console.error('Error deleting optimization:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI: Optimize workflow
router.post('/:id/optimize', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM workflow_optimizations WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Optimization not found' });
    }
    const optimization = result.rows[0];
    const analysis = await aiService.optimizeWorkflow(
      optimization.name,
      optimization.workflow_description,
      optimization.current_steps,
      optimization.bottlenecks,
      optimization.goals
    );

    await pool.query(
      'UPDATE workflow_optimizations SET ai_recommendations = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [analysis, 'optimized', id]
    );

    res.json({ analysis });
  } catch (error) {
    console.error('AI optimization error:', error);
    res.status(500).json({ error: 'AI optimization failed' });
  }
});

module.exports = router;
