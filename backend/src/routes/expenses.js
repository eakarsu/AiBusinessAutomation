const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'expenses', searchable: ['title', 'description'], filterable: ['status', 'category'], label: 'expense' });

// Get expense by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching expense:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create expense
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, amount, category, description, receipt_url, expense_date, status } = req.body;
    const result = await pool.query(
      `INSERT INTO expenses (title, amount, category, description, receipt_url, expense_date, status, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, amount, category, description, receipt_url, expense_date, status || 'pending', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update expense
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, amount, category, description, receipt_url, expense_date, status } = req.body;
    const result = await pool.query(
      `UPDATE expenses SET title = $1, amount = $2, category = $3,
       description = $4, receipt_url = $5, expense_date = $6, status = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [title, amount, category, description, receipt_url, expense_date, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete expense
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM expenses WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve expense
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE expenses SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error approving expense:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI analyze expense
router.post('/:id/analyze', authMiddleware, async (req, res) => {
  try {
    const expenseResult = await pool.query('SELECT * FROM expenses WHERE id = $1', [req.params.id]);
    if (expenseResult.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    const expense = expenseResult.rows[0];
    const analysis = await aiService.analyzeExpense(expense.description, expense.amount, expense.category);

    await pool.query(
      'UPDATE expenses SET ai_analysis = $1, updated_at = NOW() WHERE id = $2',
      [analysis, req.params.id]
    );

    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
