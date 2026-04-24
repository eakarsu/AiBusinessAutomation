const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'documents', searchable: ['title', 'content'], filterable: ['status', 'document_type', 'department'], label: 'document' });

// Get document by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create document
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, content, document_type, department, status } = req.body;
    const result = await pool.query(
      `INSERT INTO documents (title, content, document_type, department, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, content, document_type, department, status || 'pending', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update document
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, content, document_type, department, status, routed_to } = req.body;
    const result = await pool.query(
      `UPDATE documents SET title = $1, content = $2, document_type = $3,
       department = $4, status = $5, routed_to = $6, updated_at = NOW() WHERE id = $7 RETURNING *`,
      [title, content, document_type, department, status, routed_to, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete document
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM documents WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI analyze document
router.post('/:id/analyze', authMiddleware, async (req, res) => {
  try {
    const docResult = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const analysis = await aiService.analyzeDocument(docResult.rows[0].content);

    await pool.query(
      'UPDATE documents SET ai_analysis = $1, updated_at = NOW() WHERE id = $2',
      [analysis, req.params.id]
    );

    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Route document
router.post('/:id/route', authMiddleware, async (req, res) => {
  try {
    const { department, routed_to } = req.body;
    const result = await pool.query(
      `UPDATE documents SET department = $1, routed_to = $2, status = 'routed', updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [department, routed_to, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error routing document:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
