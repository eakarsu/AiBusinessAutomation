const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'onboarding', searchable: ['employee_name', 'email', 'role'], filterable: ['status', 'department'], label: 'onboarding' });

// Get onboarding by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM onboarding WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching onboarding:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create onboarding
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { employee_name, email, role, department, start_date, manager, tasks, status } = req.body;
    const result = await pool.query(
      `INSERT INTO onboarding (employee_name, email, role, department, start_date, manager, tasks, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [employee_name, email, role, department, start_date, manager, JSON.stringify(tasks || []), status || 'pending', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating onboarding:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update onboarding
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { employee_name, email, role, department, start_date, manager, tasks, status, progress } = req.body;
    const result = await pool.query(
      `UPDATE onboarding SET employee_name = $1, email = $2, role = $3,
       department = $4, start_date = $5, manager = $6, tasks = $7, status = $8, progress = $9, updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [employee_name, email, role, department, start_date, manager, JSON.stringify(tasks || []), status, progress, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating onboarding:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete onboarding
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM onboarding WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }
    res.json({ message: 'Onboarding record deleted successfully' });
  } catch (error) {
    console.error('Error deleting onboarding:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI suggest onboarding tasks
router.post('/:id/suggest-tasks', authMiddleware, async (req, res) => {
  try {
    const onboardingResult = await pool.query('SELECT * FROM onboarding WHERE id = $1', [req.params.id]);
    if (onboardingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Onboarding record not found' });
    }
    const onboarding = onboardingResult.rows[0];
    const suggestion = await aiService.suggestOnboardingTasks(onboarding.role, onboarding.department);

    await pool.query(
      'UPDATE onboarding SET ai_suggestions = $1, updated_at = NOW() WHERE id = $2',
      [suggestion, req.params.id]
    );

    res.json({ suggestion });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
