const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'invoices', searchable: ['invoice_number', 'vendor_name', 'description'], filterable: ['status', 'category'], label: 'invoice' });

// Get invoice by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create invoice
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { invoice_number, vendor_name, amount, due_date, description, category, status } = req.body;
    const result = await pool.query(
      `INSERT INTO invoices (invoice_number, vendor_name, amount, due_date, description, category, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [invoice_number, vendor_name, amount, due_date, description, category, status || 'pending', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update invoice
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { invoice_number, vendor_name, amount, due_date, description, category, status } = req.body;
    const result = await pool.query(
      `UPDATE invoices SET invoice_number = $1, vendor_name = $2, amount = $3,
       due_date = $4, description = $5, category = $6, status = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
      [invoice_number, vendor_name, amount, due_date, description, category, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete invoice
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM invoices WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json({ message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve invoice
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE invoices SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error approving invoice:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI analyze invoice
router.post('/:id/analyze', authMiddleware, async (req, res) => {
  try {
    const invoiceResult = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const analysis = await aiService.analyzeInvoice(invoiceResult.rows[0]);

    await pool.query(
      'UPDATE invoices SET ai_analysis = $1, updated_at = NOW() WHERE id = $2',
      [analysis, req.params.id]
    );

    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
