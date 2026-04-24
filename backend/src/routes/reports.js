const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'reports', searchable: ['title', 'description'], filterable: ['status', 'report_type', 'schedule'], label: 'report' });

// Get report by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create report
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, report_type, description, data_source, parameters, schedule, status } = req.body;
    const result = await pool.query(
      `INSERT INTO reports (title, report_type, description, data_source, parameters, schedule, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, report_type, description, data_source, JSON.stringify(parameters || {}), schedule, status || 'draft', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update report
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, report_type, description, data_source, parameters, schedule, status, content } = req.body;
    const result = await pool.query(
      `UPDATE reports SET title = $1, report_type = $2, description = $3,
       data_source = $4, parameters = $5, schedule = $6, status = $7, content = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [title, report_type, description, data_source, JSON.stringify(parameters || {}), schedule, status, content, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete report
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM reports WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    res.json({ message: 'Report deleted successfully' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Generate report
router.post('/:id/generate', authMiddleware, async (req, res) => {
  try {
    const reportResult = await pool.query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const report = reportResult.rows[0];
    const generatedContent = await aiService.generateReport(report.description, report.report_type);

    await pool.query(
      'UPDATE reports SET content = $1, last_generated = NOW(), status = $2, updated_at = NOW() WHERE id = $3',
      [generatedContent, 'generated', req.params.id]
    );

    res.json({ content: generatedContent });
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
