/**
 * Custom Views — 4 endpoints synthesizing data for the
 * "Automation Views" feature set.
 *
 * Domain: Business Process Automation
 *
 *  VIZ
 *  1. GET  /execution-count-chart    — workflow execution counts (bar/series)
 *  2. GET  /bottleneck-heatmap       — step x time-bucket latency heatmap
 *
 *  NON-VIZ
 *  3. POST /runbook-pdf              — generate an automation runbook PDF
 *  4. CRUD /rules                    — workflow rules editor (trigger/action)
 *        GET    /rules
 *        POST   /rules
 *        PUT    /rules/:id
 *        DELETE /rules/:id
 */
const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');

let authMiddleware;
try {
  authMiddleware = require('../middleware/auth');
} catch (e) {
  authMiddleware = (req, _res, next) => next();
}

let pool = null;
try { pool = require('../config/database'); } catch (e) { /* optional */ }

// =====================================================================
// Helpers — deterministic synthesis when DB is empty
// =====================================================================
function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const WORKFLOW_NAMES = [
  'Invoice Approval',
  'Onboarding Pipeline',
  'Expense Reimbursement',
  'Contract Review',
  'Support Ticket Triage',
  'Vendor Risk Check',
  'Compliance Audit',
  'Document Extraction',
];

function synthesizeWorkflows(count = 6) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: WORKFLOW_NAMES[i % WORKFLOW_NAMES.length],
    status: i % 3 === 0 ? 'active' : 'paused',
  }));
}

// =====================================================================
// In-memory rules store (CRUD). Seeded with sensible defaults.
// =====================================================================
let _ruleIdSeq = 1;
const rules = [];

function seedRules() {
  if (rules.length) return;
  const seeds = [
    { workflow: 'Invoice Approval',  trigger_type: 'email_received',    trigger_value: 'invoice@company.com', action_type: 'extract_fields',  action_value: 'amount,vendor,due_date', enabled: true },
    { workflow: 'Invoice Approval',  trigger_type: 'amount_threshold',  trigger_value: '>5000',               action_type: 'route_approval', action_value: 'finance_director',         enabled: true },
    { workflow: 'Onboarding',        trigger_type: 'employee_hired',    trigger_value: 'role:engineer',       action_type: 'provision',      action_value: 'github,slack,okta',        enabled: true },
    { workflow: 'Support Triage',    trigger_type: 'ticket_priority',   trigger_value: 'p1',                  action_type: 'page_oncall',    action_value: 'sre-rotation',             enabled: true },
    { workflow: 'Expense Reimburse', trigger_type: 'receipt_uploaded',  trigger_value: 'category:travel',     action_type: 'ocr_extract',    action_value: 'merchant,amount,date',     enabled: false },
  ];
  for (const s of seeds) {
    rules.push({ id: _ruleIdSeq++, ...s, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
}
seedRules();

// =====================================================================
// 1. VIZ — Execution Count Chart
// =====================================================================
router.get('/execution-count-chart', authMiddleware, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(parseInt(req.query.days || '14', 10), 60));
    let workflows = synthesizeWorkflows(6);
    if (pool) {
      try {
        const r = await pool.query('SELECT id, name, status FROM workflows ORDER BY id LIMIT 6');
        if (r.rows.length) workflows = r.rows;
      } catch (e) { /* fallback */ }
    }

    const now = Date.now();
    const dates = [];
    for (let d = days - 1; d >= 0; d--) {
      dates.push(new Date(now - d * 86400000).toISOString().slice(0, 10));
    }

    // per-workflow daily executions
    const series = workflows.map((w) => {
      const rng = seededRand((w.id || 1) * 53 + 11);
      const points = dates.map((date) => {
        const base = 30 + rng() * 200;
        const spike = rng() < 0.1 ? rng() * 150 : 0;
        return { date, count: Math.round(base + spike) };
      });
      const total = points.reduce((a, b) => a + b.count, 0);
      return { workflow_id: w.id, workflow_name: w.name, total, points };
    });

    const totals_by_date = dates.map((date) => ({
      date,
      count: series.reduce((sum, s) => sum + (s.points.find((p) => p.date === date)?.count || 0), 0),
    }));

    const grand_total = totals_by_date.reduce((a, b) => a + b.count, 0);
    const peak = totals_by_date.reduce((a, b) => (b.count > a.count ? b : a), totals_by_date[0]);

    res.json({
      days,
      workflows,
      series,
      totals_by_date,
      summary: { grand_total, peak_date: peak.date, peak_count: peak.count, workflow_count: workflows.length },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// 2. VIZ — Bottleneck Heatmap (step x time bucket)
// =====================================================================
router.get('/bottleneck-heatmap', authMiddleware, async (req, res) => {
  try {
    const workflowId = Number(req.query.workflow_id || 1);
    const buckets = Math.max(4, Math.min(parseInt(req.query.buckets || '12', 10), 24));

    const steps = [
      { id: 'trigger',  label: 'Trigger' },
      { id: 'extract',  label: 'AI Extract' },
      { id: 'validate', label: 'Validate' },
      { id: 'route',    label: 'Decision' },
      { id: 'approve',  label: 'Approval' },
      { id: 'execute',  label: 'Execute' },
      { id: 'notify',   label: 'Notify' },
      { id: 'archive',  label: 'Archive' },
    ];

    // time buckets — 2-hour windows ending now, oldest first
    const now = Date.now();
    const bucketLabels = [];
    for (let i = buckets - 1; i >= 0; i--) {
      const t = new Date(now - i * 2 * 3600 * 1000);
      bucketLabels.push(t.toISOString().slice(11, 16));
    }

    const rng = seededRand(workflowId * 97 + 19);
    const cells = []; // {step_id, bucket_index, latency_ms, severity}
    let maxLatency = 0;
    for (const step of steps) {
      const stepBase = 200 + rng() * 1800;
      for (let b = 0; b < buckets; b++) {
        let latency = stepBase + (rng() - 0.5) * stepBase * 0.4;
        if (rng() < 0.07) latency *= 2 + rng() * 3; // bottleneck spike
        latency = Math.round(latency);
        if (latency > maxLatency) maxLatency = latency;
        cells.push({ step_id: step.id, bucket_index: b, latency_ms: latency });
      }
    }
    // assign severity 0..1
    for (const c of cells) c.severity = Math.round((c.latency_ms / maxLatency) * 100) / 100;

    // worst-offender summary
    const sorted = [...cells].sort((a, b) => b.latency_ms - a.latency_ms).slice(0, 5);
    const top_bottlenecks = sorted.map((c) => ({
      step: steps.find((s) => s.id === c.step_id)?.label || c.step_id,
      bucket: bucketLabels[c.bucket_index],
      latency_ms: c.latency_ms,
    }));

    res.json({
      workflow_id: workflowId,
      steps,
      bucket_labels: bucketLabels,
      cells,
      max_latency_ms: maxLatency,
      top_bottlenecks,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// 3. NON-VIZ — Automation Runbook PDF
// =====================================================================
router.post('/runbook-pdf', authMiddleware, async (req, res) => {
  try {
    const {
      workflow_id = 1,
      workflow_name = 'Automation Runbook',
      owner = 'Operations Team',
      severity = 'medium',
      steps = [],
      escalation = '',
      notes = '',
    } = req.body || {};

    const defaultSteps = [
      { title: 'Detect trigger',     detail: 'Verify the event source and payload conformance.' },
      { title: 'Run extraction',     detail: 'Invoke the AI extractor; record field-level confidence.' },
      { title: 'Route for approval', detail: 'Apply business rules; escalate above threshold.' },
      { title: 'Execute action',     detail: 'Invoke downstream system; capture transaction id.' },
      { title: 'Notify stakeholders', detail: 'Email or post to channel; attach evidence.' },
      { title: 'Archive evidence',   detail: 'Persist artifacts to long-term storage with retention tag.' },
    ];
    const stepList = Array.isArray(steps) && steps.length ? steps : defaultSteps;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="runbook-${workflow_id}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(22).fillColor('#0f172a').text('Automation Runbook', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(14).fillColor('#1e293b').text(workflow_name);
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#475569').text(`Workflow ID: ${workflow_id}    Owner: ${owner}    Severity: ${severity}`);
    doc.text(`Generated: ${new Date().toISOString()}`);
    doc.moveDown();

    doc.fontSize(13).fillColor('#0f172a').text('Operational Steps');
    doc.moveDown(0.3);
    stepList.forEach((s, i) => {
      const title = typeof s === 'string' ? s : (s.title || `Step ${i + 1}`);
      const detail = typeof s === 'string' ? '' : (s.detail || '');
      doc.fontSize(11).fillColor('#0f172a').text(`${i + 1}. ${title}`);
      if (detail) doc.fontSize(10).fillColor('#475569').text(`   ${detail}`);
      doc.moveDown(0.15);
    });

    if (escalation) {
      doc.moveDown();
      doc.fontSize(13).fillColor('#0f172a').text('Escalation Path');
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#334155').text(escalation, { width: 500 });
    }

    if (notes) {
      doc.moveDown();
      doc.fontSize(13).fillColor('#0f172a').text('Notes');
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#334155').text(notes, { width: 500 });
    }

    doc.moveDown();
    doc.fontSize(9).fillColor('#94a3b8').text(
      'This runbook is auto-generated. Validate against current production rules before invocation.',
      { width: 500 }
    );

    doc.end();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// 4. NON-VIZ — Workflow Rules Editor (CRUD trigger/action)
// =====================================================================
router.get('/rules', authMiddleware, (req, res) => {
  res.json({
    count: rules.length,
    rules: [...rules].sort((a, b) => a.id - b.id),
    generated_at: new Date().toISOString(),
  });
});

router.post('/rules', authMiddleware, (req, res) => {
  try {
    const {
      workflow = '',
      trigger_type = '',
      trigger_value = '',
      action_type = '',
      action_value = '',
      enabled = true,
    } = req.body || {};

    if (!workflow || !trigger_type || !action_type) {
      return res.status(400).json({ error: 'workflow, trigger_type, and action_type are required' });
    }

    const now = new Date().toISOString();
    const rule = {
      id: _ruleIdSeq++,
      workflow, trigger_type, trigger_value, action_type, action_value,
      enabled: Boolean(enabled),
      created_at: now,
      updated_at: now,
    };
    rules.push(rule);
    res.status(201).json({ rule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/rules/:id', authMiddleware, (req, res) => {
  try {
    const id = Number(req.params.id);
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'rule not found' });

    const patch = req.body || {};
    const allowed = ['workflow', 'trigger_type', 'trigger_value', 'action_type', 'action_value', 'enabled'];
    for (const k of allowed) {
      if (k in patch) rules[idx][k] = patch[k];
    }
    rules[idx].updated_at = new Date().toISOString();
    res.json({ rule: rules[idx] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/rules/:id', authMiddleware, (req, res) => {
  try {
    const id = Number(req.params.id);
    const idx = rules.findIndex((r) => r.id === id);
    if (idx === -1) return res.status(404).json({ error: 'rule not found' });
    const [removed] = rules.splice(idx, 1);
    res.json({ removed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
