const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const { addStandardRoutes } = require('../middleware/routeHelper');
const aiService = require('../services/openrouter');
const router = express.Router();

// Standard routes: paginated list, bulk ops, export
addStandardRoutes(router, { table: 'data_entries', searchable: ['title', 'raw_data'], filterable: ['status', 'source_type'], label: 'data entry' });

// Get data entry by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM data_entries WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data entry not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching data entry:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create data entry
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, source_type, raw_data, extracted_data, fields_schema, status } = req.body;
    const result = await pool.query(
      `INSERT INTO data_entries (title, source_type, raw_data, extracted_data, fields_schema, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, source_type, raw_data, JSON.stringify(extracted_data || {}), JSON.stringify(fields_schema || []), status || 'pending', req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating data entry:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update data entry
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, source_type, raw_data, extracted_data, fields_schema, status } = req.body;
    const result = await pool.query(
      `UPDATE data_entries SET title = $1, source_type = $2, raw_data = $3,
       extracted_data = $4, fields_schema = $5, status = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [title, source_type, raw_data, JSON.stringify(extracted_data || {}), JSON.stringify(fields_schema || []), status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data entry not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating data entry:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete data entry
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM data_entries WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Data entry not found' });
    }
    res.json({ message: 'Data entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting data entry:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI extract data
router.post('/:id/extract', authMiddleware, async (req, res) => {
  try {
    const entryResult = await pool.query('SELECT * FROM data_entries WHERE id = $1', [req.params.id]);
    if (entryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Data entry not found' });
    }
    const entry = entryResult.rows[0];

    // Parse fields_schema safely
    let schema = [];
    if (entry.fields_schema) {
      schema = typeof entry.fields_schema === 'string'
        ? JSON.parse(entry.fields_schema)
        : entry.fields_schema;
    }

    // Get fields from schema or use defaults based on source_type
    let fields = Array.isArray(schema) && schema.length > 0
      ? schema.map(f => f.name || f)
      : [];

    // If no fields specified, use smart defaults based on source type
    if (fields.length === 0) {
      const defaultFields = {
        'invoice': ['invoice_number', 'vendor', 'amount', 'date', 'due_date', 'line_items', 'tax', 'total'],
        'email': ['sender', 'recipient', 'subject', 'date', 'key_points', 'action_items'],
        'receipt': ['merchant', 'date', 'items', 'subtotal', 'tax', 'total', 'payment_method'],
        'contract': ['parties', 'effective_date', 'terms', 'value', 'duration', 'key_clauses'],
        'form': ['name', 'email', 'phone', 'address', 'date', 'responses'],
        'document': ['title', 'author', 'date', 'summary', 'key_points'],
        'image': ['description', 'text_content', 'objects', 'people', 'location'],
        'notes': ['date', 'topic', 'key_points', 'action_items', 'decisions']
      };
      fields = defaultFields[entry.source_type] || ['name', 'date', 'amount', 'description', 'category', 'key_information'];
    }

    const extracted = await aiService.extractDataFromText(entry.raw_data, fields);

    // Store as JSON object with the AI response as text content
    const extractedJson = JSON.stringify({ content: extracted, fields: fields, extracted_at: new Date().toISOString() });

    await pool.query(
      'UPDATE data_entries SET extracted_data = $1, status = $2, updated_at = NOW() WHERE id = $3',
      [extractedJson, 'extracted', req.params.id]
    );

    res.json({ extracted });
  } catch (error) {
    console.error('AI extraction error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
