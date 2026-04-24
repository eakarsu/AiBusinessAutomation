const pool = require('../config/database');
const queryBuilder = require('./queryBuilder');
const authMiddleware = require('./auth');
const { checkRowAccess } = require('./authorization');

/**
 * Adds standard endpoints to a router: paginated list, bulk-delete, bulk-update, CSV export, PDF export.
 *
 * @param {Router} router - Express router
 * @param {object} config - { table, searchable, filterable, label }
 */
function addStandardRoutes(router, config) {
  const { table, searchable = [], filterable = [], label = 'item' } = config;

  // GET all with pagination, search, sort, filter
  // This replaces the existing GET / handler - caller should NOT define GET / themselves
  router.get('/',
    authMiddleware,
    queryBuilder({ table, searchable, filterable }),
    async (req, res) => {
      try {
        const { whereClause, params, sortField, sortOrder, limit, offset, page } = req.queryOptions;

        // Count total
        const countResult = await pool.query(
          `SELECT COUNT(*) FROM ${table} ${whereClause}`,
          params
        );
        const total = parseInt(countResult.rows[0].count);

        // Fetch page
        const dataParams = [...params, limit, offset];
        const dataResult = await pool.query(
          `SELECT * FROM ${table} ${whereClause} ORDER BY ${sortField} ${sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          dataParams
        );

        res.json({
          data: dataResult.rows,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        });
      } catch (error) {
        console.error(`Error fetching ${label}s:`, error);
        res.status(500).json({ error: 'Server error' });
      }
    }
  );

  // Bulk delete
  router.post('/bulk-delete', authMiddleware, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
      }
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const result = await pool.query(
        `DELETE FROM ${table} WHERE id IN (${placeholders}) RETURNING id`,
        ids
      );
      res.json({ message: `${result.rowCount} ${label}(s) deleted`, deleted: result.rowCount });
    } catch (error) {
      console.error(`Error bulk deleting ${label}s:`, error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Bulk update (status field)
  router.post('/bulk-update', authMiddleware, async (req, res) => {
    try {
      const { ids, updates } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
      }
      if (!updates || !updates.status) {
        return res.status(400).json({ error: 'updates.status is required' });
      }
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(', ');
      const result = await pool.query(
        `UPDATE ${table} SET status = $1, updated_at = NOW() WHERE id IN (${placeholders}) RETURNING id`,
        [updates.status, ...ids]
      );
      res.json({ message: `${result.rowCount} ${label}(s) updated`, updated: result.rowCount });
    } catch (error) {
      console.error(`Error bulk updating ${label}s:`, error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // CSV Export
  router.get('/export/csv', authMiddleware, async (req, res) => {
    try {
      const result = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
      const rows = result.rows;

      if (rows.length === 0) {
        return res.status(404).json({ error: 'No data to export' });
      }

      const headers = Object.keys(rows[0]);
      const csvRows = [headers.join(',')];

      rows.forEach(row => {
        const values = headers.map(h => {
          let val = row[h];
          if (val === null || val === undefined) val = '';
          if (typeof val === 'object') val = JSON.stringify(val);
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        });
        csvRows.push(values.join(','));
      });

      const csv = csvRows.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${table}_export.csv"`);
      res.send(csv);
    } catch (error) {
      console.error(`Error exporting ${label}s to CSV:`, error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // PDF Export
  router.get('/export/pdf', authMiddleware, async (req, res) => {
    try {
      const PDFDocument = require('pdfkit');
      const result = await pool.query(`SELECT * FROM ${table} ORDER BY id`);
      const rows = result.rows;

      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${table}_export.pdf"`);
      doc.pipe(res);

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text(`${label.charAt(0).toUpperCase() + label.slice(1)} Report`, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()} | Total Records: ${rows.length}`, { align: 'center' });
      doc.moveDown(1);

      if (rows.length === 0) {
        doc.fontSize(12).text('No records to display.');
      } else {
        const headers = Object.keys(rows[0]).filter(h => !['password', 'reset_token', 'reset_token_expires', 'steps', 'actions', 'approval_chain', 'tasks', 'participants', 'parameters', 'fields_schema', 'extracted_data', 'stack_trace'].includes(h));
        const colCount = Math.min(headers.length, 6); // limit columns
        const displayHeaders = headers.slice(0, colCount);
        const colWidth = (doc.page.width - 100) / colCount;

        // Table header
        let y = doc.y;
        doc.font('Helvetica-Bold').fontSize(8);
        displayHeaders.forEach((h, i) => {
          doc.text(h.replace(/_/g, ' ').toUpperCase(), 50 + i * colWidth, y, { width: colWidth - 5, height: 15 });
        });
        y += 18;
        doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
        y += 5;

        // Table rows
        doc.font('Helvetica').fontSize(7);
        rows.forEach((row, rowIdx) => {
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 50;
          }
          displayHeaders.forEach((h, i) => {
            let val = row[h];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'object') val = JSON.stringify(val);
            val = String(val).substring(0, 40);
            doc.text(val, 50 + i * colWidth, y, { width: colWidth - 5, height: 12 });
          });
          y += 15;
        });
      }

      doc.end();
    } catch (error) {
      console.error(`Error exporting ${label}s to PDF:`, error);
      res.status(500).json({ error: 'Server error' });
    }
  });
}

module.exports = { addStandardRoutes };
