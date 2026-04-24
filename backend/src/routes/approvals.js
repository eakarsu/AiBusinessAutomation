const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'approvals', searchable: ['title', 'description'], filterable: ['status', 'request_type', 'priority'], label: 'approval' });

// Get approval by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM approvals WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching approval:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create approval request
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, request_type, amount, priority, approval_chain } = req.body;
    const result = await pool.query(
      `INSERT INTO approvals (title, description, request_type, amount, priority, approval_chain, status, requested_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7) RETURNING *`,
      [title, description, request_type, amount, priority || 'medium', JSON.stringify(approval_chain || []), req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating approval:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update approval
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, description, request_type, amount, priority, status, approval_chain } = req.body;
    const result = await pool.query(
      `UPDATE approvals SET title = $1, description = $2, request_type = $3,
       amount = $4, priority = $5, status = $6, approval_chain = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [title, description, request_type, amount, priority, status, JSON.stringify(approval_chain || []), req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating approval:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve request
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { comments } = req.body;
    const result = await pool.query(
      `UPDATE approvals SET status = 'approved', approved_by = $1, approval_comments = $2,
       approved_at = NOW(), updated_at = NOW() WHERE id = $3 RETURNING *`,
      [req.user.id, comments, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error approving:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject request
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { comments } = req.body;
    const result = await pool.query(
      `UPDATE approvals SET status = 'rejected', approved_by = $1, approval_comments = $2,
       updated_at = NOW() WHERE id = $3 RETURNING *`,
      [req.user.id, comments, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error rejecting:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete approval
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM approvals WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    res.json({ message: 'Approval deleted successfully' });
  } catch (error) {
    console.error('Error deleting approval:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI suggest approval chain
router.post('/ai/suggest-chain', authMiddleware, async (req, res) => {
  try {
    const { request_type, amount } = req.body;
    const suggestion = await aiService.suggestApprovalChain(request_type, amount);
    res.json({ suggestion });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
