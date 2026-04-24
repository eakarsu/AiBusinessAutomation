const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'automation_tasks', searchable: ['title', 'description'], filterable: ['status', 'task_type'], label: 'task' });

// Get task by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM automation_tasks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create task
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, task_type, schedule, trigger_condition, actions, status } = req.body;
    const result = await pool.query(
      `INSERT INTO automation_tasks (title, description, task_type, schedule, trigger_condition, actions, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, task_type, schedule, trigger_condition, JSON.stringify(actions || []), status || 'active', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update task
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, task_type, schedule, trigger_condition, actions, status } = req.body;
    const result = await pool.query(
      `UPDATE automation_tasks SET title = $1, description = $2, task_type = $3,
       schedule = $4, trigger_condition = $5, actions = $6, status = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [title, description, task_type, schedule, trigger_condition, JSON.stringify(actions || []), status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete task
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM automation_tasks WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Execute task
router.post('/:id/execute', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE automation_tasks SET last_run = NOW(), run_count = COALESCE(run_count, 0) + 1,
       updated_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task executed successfully', task: result.rows[0] });
  } catch (error) {
    console.error('Error executing task:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
