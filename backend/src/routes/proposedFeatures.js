/**
 * Proposed NEW non-CRUD features per audit report.
 * Each is implemented as an HTTP endpoint backed by AI/SQL aggregation.
 *
 * 1. Workflow Trigger Engine — list / fire workflow_triggers
 * 2. AI Bottleneck Heatmap — aggregate process_mining for heat-map view
 * 3. Live Anomaly Detection — score new expense vs sliding-window history
 * 4. Natural-Language Workflow Builder — chat-to-workflow
 * 5. Compliance Deadline Watchdog — list at-risk deadlines + AI memo
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const aiService = require('../services/openrouter');
const { body, validationResult } = require('express-validator');

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
}

// =====================================================
// 1. Workflow Trigger Engine
// =====================================================
router.get('/workflow-triggers', authMiddleware, async (req, res) => {
  try {
    let rows = [];
    try {
      const r = await pool.query('SELECT * FROM workflow_triggers ORDER BY created_at DESC LIMIT 100');
      rows = r.rows;
    } catch (e) {
      // table may not exist yet
    }
    res.json({ triggers: rows, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workflow-triggers',
  authMiddleware,
  [
    body('workflow_id').notEmpty().withMessage('workflow_id is required'),
    body('trigger_type').notEmpty().withMessage('trigger_type is required (cron|condition|event)'),
    body('schedule_or_condition').notEmpty().withMessage('schedule_or_condition is required'),
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { workflow_id, trigger_type, schedule_or_condition, action, enabled = true } = req.body;
      // Auto-create table if it doesn't exist
      try {
        await pool.query(`CREATE TABLE IF NOT EXISTS workflow_triggers (
          id SERIAL PRIMARY KEY,
          workflow_id INTEGER,
          trigger_type VARCHAR(50),
          schedule_or_condition TEXT,
          action TEXT,
          enabled BOOLEAN DEFAULT TRUE,
          last_fired_at TIMESTAMP,
          fire_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          created_by INTEGER
        )`);
      } catch (e) {}
      const r = await pool.query(
        `INSERT INTO workflow_triggers (workflow_id, trigger_type, schedule_or_condition, action, enabled, created_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [workflow_id, trigger_type, schedule_or_condition, action, enabled, req.user?.id]
      );
      res.status(201).json(r.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

router.post('/workflow-triggers/:id/fire',
  authMiddleware,
  async (req, res) => {
    try {
      const id = req.params.id;
      let trigger = null;
      try {
        const r = await pool.query('SELECT * FROM workflow_triggers WHERE id=$1', [id]);
        trigger = r.rows[0];
      } catch (e) {}
      if (!trigger) return res.status(404).json({ error: 'Trigger not found' });

      // Update fire count
      try {
        await pool.query('UPDATE workflow_triggers SET fire_count = COALESCE(fire_count,0) + 1, last_fired_at = NOW() WHERE id=$1', [id]);
      } catch (e) {}

      res.json({
        success: true,
        message: `Trigger ${id} fired (workflow ${trigger.workflow_id}, action: ${trigger.action || 'noop'})`,
        fired_at: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// =====================================================
// 2. AI Bottleneck Heatmap
// =====================================================
router.get('/bottleneck-heatmap', authMiddleware, async (req, res) => {
  try {
    let analyzed = [];
    try {
      const r = await pool.query(
        `SELECT department, process_type, complexity, COUNT(*) AS process_count,
                COUNT(*) FILTER (WHERE ai_analysis IS NOT NULL AND ai_analysis ILIKE '%bottleneck%') AS bottleneck_count
         FROM process_mining
         WHERE status = 'analyzed' OR ai_analysis IS NOT NULL
         GROUP BY department, process_type, complexity
         ORDER BY bottleneck_count DESC, process_count DESC
         LIMIT 50`
      );
      analyzed = r.rows.map(row => ({
        department: row.department || 'Unknown',
        process_type: row.process_type || 'Unknown',
        complexity: row.complexity || 'medium',
        process_count: parseInt(row.process_count) || 0,
        bottleneck_count: parseInt(row.bottleneck_count) || 0,
        intensity: parseInt(row.process_count) > 0
          ? Math.round((parseInt(row.bottleneck_count) / parseInt(row.process_count)) * 100)
          : 0,
      }));
    } catch (e) {}

    res.json({
      heatmap: analyzed,
      generated_at: new Date().toISOString(),
      legend: '0-25% green; 25-50% yellow; 50-75% orange; 75-100% red',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================
// 3. Live Anomaly Detection (expenses)
// =====================================================
router.post('/anomaly-check',
  authMiddleware,
  [
    body('amount').isNumeric().withMessage('amount must be a number'),
    body('category').notEmpty().withMessage('category is required'),
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { amount, category, vendor } = req.body;
      const amt = parseFloat(amount);

      let stats = { count: 0, avg: 0, stddev: 0, max: 0 };
      try {
        const r = await pool.query(
          `SELECT COUNT(*) AS count,
                  COALESCE(AVG(amount),0) AS avg,
                  COALESCE(STDDEV(amount),0) AS stddev,
                  COALESCE(MAX(amount),0) AS max
             FROM expenses
            WHERE category = $1
              AND expense_date >= NOW() - INTERVAL '90 days'`,
          [category]
        );
        stats = {
          count: parseInt(r.rows[0].count) || 0,
          avg: parseFloat(r.rows[0].avg) || 0,
          stddev: parseFloat(r.rows[0].stddev) || 0,
          max: parseFloat(r.rows[0].max) || 0,
        };
      } catch (e) {}

      const zScore = stats.stddev > 0 ? (amt - stats.avg) / stats.stddev : 0;
      const pctOverAvg = stats.avg > 0 ? Math.round(((amt - stats.avg) / stats.avg) * 100) : 0;
      const isAnomaly = stats.count >= 3 && (zScore > 2 || pctOverAvg > 40);

      let aiNote = null;
      if (isAnomaly) {
        try {
          aiNote = await aiService.generateCompletion(
            `An expense was submitted that appears anomalous: amount=$${amt}, category=${category}, vendor=${vendor || 'unknown'}.
            Compared to last 90 days for this category: avg=$${stats.avg.toFixed(2)}, stddev=$${stats.stddev.toFixed(2)}, max=$${stats.max.toFixed(2)}.
            Briefly explain (3-4 sentences) why this is unusual and what reviewers should verify.`,
            'You are an expense fraud and anomaly detection assistant.'
          );
        } catch (e) {
          aiNote = `Amount $${amt} is ${pctOverAvg}% above the 90-day average ($${stats.avg.toFixed(2)}).`;
        }
      }

      res.json({
        is_anomaly: isAnomaly,
        amount: amt,
        category,
        vendor,
        history_window_days: 90,
        history_stats: stats,
        z_score: parseFloat(zScore.toFixed(2)),
        pct_over_avg: pctOverAvg,
        explanation: aiNote,
        recommended_action: isAnomaly ? 'flag_for_review' : 'auto_approve',
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// =====================================================
// 4. Natural-Language Workflow Builder
// =====================================================
router.post('/workflow-builder',
  authMiddleware,
  [body('description').notEmpty().withMessage('description is required (plain English)')],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { description, save = false } = req.body;
      const aiResponse = await aiService.generateCompletion(
        `A user wants to create a business workflow. From their plain-English description, output strictly the following JSON shape (no extra prose):
{
  "name": "...",
  "description": "...",
  "trigger_type": "manual|scheduled|email|document_upload|form_submission|condition",
  "steps": [ { "step": 1, "name": "...", "owner": "...", "sla_hours": 24, "type": "task|approval|notification|integration" } ],
  "estimated_cycle_time_hours": <number>,
  "kpis": ["..."]
}

User description: ${description}`,
        'You are a workflow design assistant. Always respond with strictly valid JSON.'
      );

      let parsed = null;
      try {
        const m = aiResponse.match(/\{[\s\S]*\}/);
        parsed = m ? JSON.parse(m[0]) : null;
      } catch (e) {
        parsed = null;
      }

      let saved = null;
      if (save && parsed?.name) {
        try {
          const r = await pool.query(
            `INSERT INTO workflows (name, description, trigger_type, steps, status, created_by)
             VALUES ($1,$2,$3,$4,'draft',$5) RETURNING *`,
            [parsed.name, parsed.description || description, parsed.trigger_type || 'manual', JSON.stringify(parsed.steps || []), req.user?.id]
          );
          saved = r.rows[0];
        } catch (e) {
          saved = { error: 'Could not persist (DB shape mismatch): ' + e.message };
        }
      }

      res.json({ raw_ai_output: aiResponse, parsed, saved });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// =====================================================
// 5. Compliance Deadline Watchdog
// =====================================================
router.get('/compliance-watchdog', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.query.days_ahead) || 30;
    let upcoming = [];
    try {
      const r = await pool.query(
        `SELECT id, title, regulation_type, requirement, due_date, responsible_party, status
           FROM compliance
          WHERE due_date IS NOT NULL
            AND due_date <= NOW() + ($1 || ' days')::INTERVAL
            AND status NOT IN ('compliant')
          ORDER BY due_date ASC
          LIMIT 100`,
        [days]
      );
      upcoming = r.rows.map(row => {
        const due = new Date(row.due_date);
        const daysLeft = Math.round((due - Date.now()) / 86400000);
        let urgency = 'green';
        if (daysLeft <= 7) urgency = 'red';
        else if (daysLeft <= 14) urgency = 'orange';
        else if (daysLeft <= 30) urgency = 'yellow';
        return { ...row, days_left: daysLeft, urgency };
      });
    } catch (e) {}

    res.json({
      upcoming_deadlines: upcoming,
      window_days: days,
      summary: {
        total: upcoming.length,
        red: upcoming.filter(u => u.urgency === 'red').length,
        orange: upcoming.filter(u => u.urgency === 'orange').length,
        yellow: upcoming.filter(u => u.urgency === 'yellow').length,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/compliance-watchdog/:id/draft-memo',
  authMiddleware,
  async (req, res) => {
    try {
      const id = req.params.id;
      let item = null;
      try {
        const r = await pool.query('SELECT * FROM compliance WHERE id=$1', [id]);
        item = r.rows[0];
      } catch (e) {}
      if (!item) return res.status(404).json({ error: 'Compliance item not found' });

      const memo = await aiService.generateCompletion(
        `Draft a remediation memo for the responsible party. Include:
- Subject line
- Compliance item summary (regulation: ${item.regulation_type})
- Requirement: ${item.requirement}
- Current status: ${item.current_status || 'unknown'}
- Due date: ${item.due_date}
- Concrete next-step checklist (5 items max)
- Escalation path if not resolved by due date

Keep tone professional, direct, and action-oriented.`,
        'You are a compliance program manager drafting concise remediation memos.'
      );

      res.json({ compliance_id: id, memo, generated_at: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
