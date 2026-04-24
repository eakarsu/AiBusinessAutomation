const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'vendors', searchable: ['name', 'contact_name', 'contact_email'], filterable: ['status', 'category'], label: 'vendor' });

// Get vendor by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create vendor
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, category, contact_name, contact_email, contact_phone, address, contract_value, contract_start, contract_end, rating, status } = req.body;
    const result = await pool.query(
      `INSERT INTO vendors (name, category, contact_name, contact_email, contact_phone, address, contract_value, contract_start, contract_end, rating, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [name, category, contact_name, contact_email, contact_phone, address, contract_value, contract_start, contract_end, rating, status || 'active', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update vendor
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, category, contact_name, contact_email, contact_phone, address, contract_value, contract_start, contract_end, rating, status } = req.body;
    const result = await pool.query(
      `UPDATE vendors SET name = $1, category = $2, contact_name = $3,
       contact_email = $4, contact_phone = $5, address = $6, contract_value = $7,
       contract_start = $8, contract_end = $9, rating = $10, status = $11, updated_at = NOW()
       WHERE id = $12 RETURNING *`,
      [name, category, contact_name, contact_email, contact_phone, address, contract_value, contract_start, contract_end, rating, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete vendor
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM vendors WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI evaluate vendor
router.post('/:id/evaluate', authMiddleware, async (req, res) => {
  try {
    const { criteria } = req.body;
    const vendorResult = await pool.query('SELECT * FROM vendors WHERE id = $1', [req.params.id]);
    if (vendorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    const vendor = vendorResult.rows[0];
    const evaluation = await aiService.evaluateVendor(vendor.name, criteria || 'quality, reliability, cost, communication');

    await pool.query(
      'UPDATE vendors SET ai_evaluation = $1, updated_at = NOW() WHERE id = $2',
      [evaluation, req.params.id]
    );

    res.json({ evaluation });
  } catch (error) {
    console.error('AI evaluation error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
