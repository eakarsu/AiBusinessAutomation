const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'roi_calculations', searchable: ['name', 'project_description'], filterable: ['status', 'automation_type'], label: 'ROI calculation' });

// Get single ROI calculation
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM roi_calculations WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ROI calculation not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching ROI calculation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new ROI calculation
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, project_description, implementation_cost, annual_savings, time_savings_hours,
            current_fte_cost, automation_type, payback_period } = req.body;
    const result = await pool.query(
      `INSERT INTO roi_calculations (name, project_description, implementation_cost, annual_savings,
       time_savings_hours, current_fte_cost, automation_type, payback_period, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', $9) RETURNING *`,
      [name, project_description, implementation_cost, annual_savings, time_savings_hours,
       current_fte_cost, automation_type, payback_period, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating ROI calculation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update ROI calculation
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, project_description, implementation_cost, annual_savings, time_savings_hours,
            current_fte_cost, automation_type, payback_period, status } = req.body;
    const result = await pool.query(
      `UPDATE roi_calculations SET name = $1, project_description = $2, implementation_cost = $3,
       annual_savings = $4, time_savings_hours = $5, current_fte_cost = $6, automation_type = $7,
       payback_period = $8, status = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 RETURNING *`,
      [name, project_description, implementation_cost, annual_savings, time_savings_hours,
       current_fte_cost, automation_type, payback_period, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ROI calculation not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating ROI calculation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete ROI calculation
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM roi_calculations WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ROI calculation not found' });
    }
    res.json({ message: 'ROI calculation deleted successfully' });
  } catch (error) {
    console.error('Error deleting ROI calculation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI: Calculate and analyze ROI
router.post('/:id/calculate', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM roi_calculations WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'ROI calculation not found' });
    }
    const roi = result.rows[0];
    const analysis = await aiService.calculateROI(
      roi.name,
      roi.project_description,
      roi.implementation_cost,
      roi.annual_savings,
      roi.time_savings_hours,
      roi.current_fte_cost,
      roi.automation_type
    );

    await pool.query(
      'UPDATE roi_calculations SET ai_analysis = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
      [analysis, 'calculated', id]
    );

    res.json({ analysis });
  } catch (error) {
    console.error('AI calculation error:', error);
    res.status(500).json({ error: 'AI calculation failed' });
  }
});

module.exports = router;
