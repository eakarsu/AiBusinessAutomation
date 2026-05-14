// Apply pass 5 — backlog implementations.
//
// All routes here are additive. They use `CREATE TABLE IF NOT EXISTS`,
// no existing schema is modified, and AI calls return 503 when
// OPENROUTER_API_KEY is missing.
//
// Env vars (documented):
//   OPENROUTER_API_KEY   — gates AI agent orchestration + RAG synthesis
//   WEBHOOK_HMAC_SECRET  — optional shared secret for outbound webhook signing
//                          (X-Hub-Signature-256). If unset, payload is sent unsigned.
//
// PRODUCT-DECISION defaults:
//   - Multi-agent: 4 fixed agents (planner, retriever, executor, critic)
//     run sequentially with a max-iterations cap of 3.
//   - RAG corpus: in-memory; documents are stored in a new `rag_documents`
//     table and naive token-overlap similarity is used (no embeddings).
//   - White-label: single tenant per user (`whitelabel_tenants` table); the
//     "current tenant" is resolved via `X-Tenant-Slug` header or the
//     authenticated user's first tenant.

const express = require('express');
const crypto = require('crypto');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const aiService = require('../services/openrouter');

const router = express.Router();

// ────────────────────────────────────────────────────────────────────────────
// Schema bootstrap (idempotent, additive).
// ────────────────────────────────────────────────────────────────────────────
async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id SERIAL PRIMARY KEY,
      webhook_id INTEGER,
      event VARCHAR(100),
      payload JSONB,
      status VARCHAR(20) DEFAULT 'pending',
      attempt INT DEFAULT 0,
      response_status INT,
      response_body TEXT,
      signature TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      delivered_at TIMESTAMP
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      goal TEXT,
      status VARCHAR(20) DEFAULT 'queued',
      transcript JSONB,
      result JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      completed_at TIMESTAMP
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rag_documents (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      title TEXT,
      content TEXT,
      tags TEXT[],
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS whitelabel_tenants (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      slug VARCHAR(100) UNIQUE,
      brand_name VARCHAR(200),
      primary_color VARCHAR(20),
      logo_url TEXT,
      contact_email TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
}
ensureTables();

router.use(authMiddleware);

// ────────────────────────────────────────────────────────────────────────────
// 1. Outbound webhook delivery — TOO-RISKY mitigations:
//    - In-process delivery only (no background worker).
//    - Synchronous attempt with optional retry; payload is signed with
//      HMAC-SHA256 if WEBHOOK_HMAC_SECRET is set.
//    - Records every attempt to `webhook_deliveries`.
//    - 5s timeout; never throws to caller.
// ────────────────────────────────────────────────────────────────────────────
function signPayload(rawBody) {
  const secret = process.env.WEBHOOK_HMAC_SECRET;
  if (!secret) return null;
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

async function tryFetch(url, opts, ms = 5000) {
  // Use node's built-in fetch (Node 18+); fall back to a manual abort.
  if (typeof fetch !== 'function') {
    throw new Error('global fetch unavailable; upgrade Node to >=18');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, signal: controller.signal });
    return r;
  } finally {
    clearTimeout(timer);
  }
}

router.post('/deliveries/send', async (req, res) => {
  try {
    const { webhook_id, event, payload, max_attempts = 3 } = req.body || {};
    if (!webhook_id || !event) {
      return res.status(400).json({ error: 'webhook_id and event are required' });
    }
    const w = await pool.query(
      'SELECT id, url, events, active FROM webhooks WHERE id = $1 AND user_id = $2',
      [webhook_id, req.user?.id || null]
    );
    if (w.rowCount === 0) return res.status(404).json({ error: 'webhook not found' });
    const wh = w.rows[0];
    if (!wh.active) return res.status(400).json({ error: 'webhook is not active' });
    if (Array.isArray(wh.events) && !wh.events.includes(event)) {
      return res.status(400).json({ error: `webhook is not subscribed to ${event}` });
    }

    const body = JSON.stringify({ event, data: payload || {}, ts: new Date().toISOString() });
    const signature = signPayload(body);
    let lastResp = null;
    let attempt = 0;
    let status = 'failed';
    let responseStatus = null;
    let responseBody = null;

    while (attempt < Math.min(max_attempts, 5)) {
      attempt += 1;
      try {
        const r = await tryFetch(wh.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(signature ? { 'X-Hub-Signature-256': signature } : {}),
            'X-Webhook-Event': event,
            'X-Webhook-Attempt': String(attempt)
          },
          body
        });
        responseStatus = r.status;
        responseBody = await r.text().then(t => t.slice(0, 2000)).catch(() => null);
        if (r.ok) {
          status = 'delivered';
          break;
        }
      } catch (err) {
        responseStatus = null;
        responseBody = err.message;
      }
      // simple backoff
      await new Promise(r => setTimeout(r, 200 * attempt));
    }

    const ins = await pool.query(
      `INSERT INTO webhook_deliveries
       (webhook_id, event, payload, status, attempt, response_status, response_body, signature, delivered_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $4 = 'delivered' THEN NOW() ELSE NULL END)
       RETURNING id, status, attempt, response_status, created_at, delivered_at`,
      [webhook_id, event, payload || {}, status, attempt, responseStatus, responseBody, signature]
    );
    res.json({
      delivery: ins.rows[0],
      signature_used: !!signature,
      missing: signature ? null : 'WEBHOOK_HMAC_SECRET (optional, recommended for production)'
    });
  } catch (err) {
    res.status(500).json({ error: 'delivery failed', details: err.message });
  }
});

router.get('/deliveries', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT d.id, d.webhook_id, d.event, d.status, d.attempt, d.response_status,
              d.created_at, d.delivered_at
       FROM webhook_deliveries d
       JOIN webhooks w ON w.id = d.webhook_id
       WHERE w.user_id = $1
       ORDER BY d.created_at DESC LIMIT 100`,
      [req.user?.id || null]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Multi-agent orchestration — PRODUCT-DECISION:
//    Fixed sequential pipeline of 4 agents (planner, retriever, executor,
//    critic). Each agent is a single OpenRouter call. Caps at 3 iterations
//    to bound cost. Returns a transcript and a final answer.
// ────────────────────────────────────────────────────────────────────────────
const AGENT_PIPELINE = [
  { name: 'planner', prompt: 'You are the Planner agent. Break the user goal into 3-5 concrete sub-tasks. Output a numbered list.' },
  { name: 'retriever', prompt: 'You are the Retriever agent. Given the plan, list the data/context the team needs. Output a bullet list of "needed: <item>" lines.' },
  { name: 'executor', prompt: 'You are the Executor agent. Given plan + retrieval notes, draft the deliverable. Be concrete and actionable.' },
  { name: 'critic', prompt: 'You are the Critic agent. Review the deliverable for gaps, errors, or missing edge cases. List up to 5 fixes.' }
];

router.post('/agents/run', async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'AI unavailable', missing: 'OPENROUTER_API_KEY' });
    }
    const { goal, max_iterations = 1 } = req.body || {};
    if (!goal || typeof goal !== 'string') {
      return res.status(400).json({ error: 'goal (string) is required' });
    }
    const iters = Math.min(Math.max(parseInt(max_iterations) || 1, 1), 3);
    const ins = await pool.query(
      `INSERT INTO agent_runs (user_id, goal, status) VALUES ($1, $2, 'running') RETURNING id`,
      [req.user?.id || null, goal]
    );
    const runId = ins.rows[0].id;

    const transcript = [];
    let context = `Goal: ${goal}`;
    try {
      for (let i = 0; i < iters; i++) {
        for (const agent of AGENT_PIPELINE) {
          const out = await aiService.generateCompletion(context, agent.prompt);
          transcript.push({ iteration: i + 1, agent: agent.name, output: out });
          context += `\n\n[${agent.name}]\n${out}`;
        }
      }
      const finalAnswer = transcript[transcript.length - 1]?.output || '';
      await pool.query(
        `UPDATE agent_runs SET status='complete', transcript=$1, result=$2, completed_at=NOW() WHERE id=$3`,
        [JSON.stringify(transcript), JSON.stringify({ answer: finalAnswer }), runId]
      ).catch(() => {});
      return res.json({ run_id: runId, transcript, answer: finalAnswer });
    } catch (e) {
      await pool.query(
        `UPDATE agent_runs SET status='failed', transcript=$1, completed_at=NOW() WHERE id=$2`,
        [JSON.stringify(transcript), runId]
      ).catch(() => {});
      throw e;
    }
  } catch (err) {
    if ((err.message || '').includes('AI service')) {
      return res.status(503).json({ error: 'AI service unavailable', missing: 'OPENROUTER_API_KEY' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.get('/agents/runs', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, goal, status, created_at, completed_at FROM agent_runs WHERE user_id = $1 ORDER BY id DESC LIMIT 50`,
      [req.user?.id || null]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/agents/runs/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT * FROM agent_runs WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user?.id || null]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ────────────────────────────────────────────────────────────────────────────
// 3. RAG over playbooks — PRODUCT-DECISION:
//    No vector DB in scope. Documents stored in `rag_documents`. At query
//    time we score by token-overlap (Jaccard-ish) and synthesize an answer
//    via the existing OpenRouter helper. This is a small-corpus baseline.
// ────────────────────────────────────────────────────────────────────────────
function tokenize(s) {
  return String(s || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}
function score(query, doc) {
  const q = new Set(tokenize(query));
  const d = new Set(tokenize(doc));
  if (q.size === 0 || d.size === 0) return 0;
  let overlap = 0;
  for (const t of q) if (d.has(t)) overlap++;
  return overlap / Math.sqrt(q.size * d.size);
}

router.post('/rag/documents', async (req, res) => {
  try {
    const { title, content, tags } = req.body || {};
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }
    const r = await pool.query(
      `INSERT INTO rag_documents (user_id, title, content, tags) VALUES ($1, $2, $3, $4)
       RETURNING id, title, created_at`,
      [req.user?.id || null, title || 'untitled', content, Array.isArray(tags) ? tags : []]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/rag/documents', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, title, tags, created_at FROM rag_documents WHERE user_id = $1 ORDER BY id DESC LIMIT 200`,
      [req.user?.id || null]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/rag/query', async (req, res) => {
  try {
    const { question, k = 3 } = req.body || {};
    if (!question) return res.status(400).json({ error: 'question is required' });
    const docs = await pool.query(
      `SELECT id, title, content, tags FROM rag_documents WHERE user_id = $1`,
      [req.user?.id || null]
    );
    const ranked = docs.rows
      .map(d => ({ ...d, score: score(question, `${d.title} ${d.content}`) }))
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.min(parseInt(k) || 3, 10));

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({
        error: 'AI synthesis unavailable',
        missing: 'OPENROUTER_API_KEY',
        retrieved: ranked.map(r => ({ id: r.id, title: r.title, score: r.score }))
      });
    }
    const sys = 'You answer business-process questions strictly from the provided playbook excerpts. Cite document titles in brackets like [Title]. If the excerpts do not contain the answer, say so.';
    const ctx = ranked.map(d => `[${d.title}]\n${d.content}`).join('\n\n---\n\n');
    const ans = await aiService.generateCompletion(`Question: ${question}\n\nExcerpts:\n${ctx}`, sys);
    res.json({
      answer: ans,
      retrieved: ranked.map(r => ({ id: r.id, title: r.title, score: r.score }))
    });
  } catch (err) {
    if ((err.message || '').includes('AI service')) {
      return res.status(503).json({ error: 'AI service unavailable', missing: 'OPENROUTER_API_KEY' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 4. White-label / reseller — PRODUCT-DECISION:
//    Minimal: each user can register one or more tenants with a brand
//    profile. The /resolve endpoint returns the active tenant for the
//    request (X-Tenant-Slug header > user's first tenant > null).
// ────────────────────────────────────────────────────────────────────────────
router.get('/whitelabel/tenants', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, slug, brand_name, primary_color, logo_url, contact_email, created_at
       FROM whitelabel_tenants WHERE user_id = $1 ORDER BY id ASC`,
      [req.user?.id || null]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/whitelabel/tenants', async (req, res) => {
  try {
    const { slug, brand_name, primary_color, logo_url, contact_email } = req.body || {};
    if (!slug || !/^[a-z0-9-]{3,50}$/.test(slug)) {
      return res.status(400).json({ error: 'slug must be lowercase alphanumeric (3-50)' });
    }
    if (!brand_name) return res.status(400).json({ error: 'brand_name is required' });
    const r = await pool.query(
      `INSERT INTO whitelabel_tenants (user_id, slug, brand_name, primary_color, logo_url, contact_email)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (slug) DO UPDATE SET brand_name=EXCLUDED.brand_name,
         primary_color=EXCLUDED.primary_color, logo_url=EXCLUDED.logo_url,
         contact_email=EXCLUDED.contact_email
       RETURNING *`,
      [req.user?.id || null, slug, brand_name, primary_color || '#1f2937', logo_url || null, contact_email || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/whitelabel/resolve', async (req, res) => {
  try {
    const slug = req.header('X-Tenant-Slug');
    let row = null;
    if (slug) {
      const r = await pool.query(
        `SELECT * FROM whitelabel_tenants WHERE slug = $1 AND user_id = $2`,
        [slug, req.user?.id || null]
      );
      row = r.rows[0] || null;
    }
    if (!row) {
      const r = await pool.query(
        `SELECT * FROM whitelabel_tenants WHERE user_id = $1 ORDER BY id ASC LIMIT 1`,
        [req.user?.id || null]
      );
      row = r.rows[0] || null;
    }
    res.json({
      tenant: row,
      source: row ? (slug ? 'header' : 'default') : 'none'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Diagnostics — what env is missing for full functionality
router.get('/_diagnostics', (req, res) => {
  res.json({
    openrouter: !!process.env.OPENROUTER_API_KEY,
    webhook_hmac: !!process.env.WEBHOOK_HMAC_SECRET,
    missing_env: [
      !process.env.OPENROUTER_API_KEY ? 'OPENROUTER_API_KEY' : null,
      !process.env.WEBHOOK_HMAC_SECRET ? 'WEBHOOK_HMAC_SECRET' : null
    ].filter(Boolean)
  });
});

module.exports = router;
