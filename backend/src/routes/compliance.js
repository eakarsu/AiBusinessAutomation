const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'compliance', searchable: ['title', 'requirement', 'responsible_party'], filterable: ['status', 'regulation_type'], label: 'compliance item' });

// Get compliance by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM compliance WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching compliance:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create compliance
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, regulation_type, requirement, current_status, due_date, responsible_party, evidence, status } = req.body;
    const result = await pool.query(
      `INSERT INTO compliance (title, regulation_type, requirement, current_status, due_date, responsible_party, evidence, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, regulation_type, requirement, current_status, due_date, responsible_party, evidence, status || 'pending', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating compliance:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update compliance
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, regulation_type, requirement, current_status, due_date, responsible_party, evidence, status } = req.body;
    const result = await pool.query(
      `UPDATE compliance SET title = $1, regulation_type = $2, requirement = $3,
       current_status = $4, due_date = $5, responsible_party = $6, evidence = $7, status = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [title, regulation_type, requirement, current_status, due_date, responsible_party, evidence, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating compliance:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete compliance
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM compliance WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance item not found' });
    }
    res.json({ message: 'Compliance item deleted successfully' });
  } catch (error) {
    console.error('Error deleting compliance:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI analyze compliance
router.post('/:id/analyze', authMiddleware, async (req, res) => {
  try {
    const complianceResult = await pool.query('SELECT * FROM compliance WHERE id = $1', [req.params.id]);
    if (complianceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Compliance item not found' });
    }
    const compliance = complianceResult.rows[0];
    const analysis = await aiService.analyzeCompliance(compliance.requirement, compliance.current_status);

    await pool.query(
      'UPDATE compliance SET ai_analysis = $1, updated_at = NOW() WHERE id = $2',
      [analysis, req.params.id]
    );

    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
