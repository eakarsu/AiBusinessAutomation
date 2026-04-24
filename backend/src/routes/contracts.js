const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'contracts', searchable: ['title', 'party_name', 'terms'], filterable: ['status', 'contract_type'], label: 'contract' });

// Get contract by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create contract
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, party_name, contract_type, value, start_date, end_date, terms, status } = req.body;
    const result = await pool.query(
      `INSERT INTO contracts (title, party_name, contract_type, value, start_date, end_date, terms, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, party_name, contract_type, value, start_date, end_date, terms, status || 'draft', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update contract
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, party_name, contract_type, value, start_date, end_date, terms, status } = req.body;
    const result = await pool.query(
      `UPDATE contracts SET title = $1, party_name = $2, contract_type = $3,
       value = $4, start_date = $5, end_date = $6, terms = $7, status = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [title, party_name, contract_type, value, start_date, end_date, terms, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete contract
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM contracts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    res.json({ message: 'Contract deleted successfully' });
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI analyze contract
router.post('/:id/analyze', authMiddleware, async (req, res) => {
  try {
    const contractResult = await pool.query('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    if (contractResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    const contract = contractResult.rows[0];
    const analysis = await aiService.analyzeContract(contract.terms || JSON.stringify(contract));

    await pool.query(
      'UPDATE contracts SET ai_analysis = $1, updated_at = NOW() WHERE id = $2',
      [analysis, req.params.id]
    );

    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
