'use strict';
delete process.env.OPENROUTER_API_KEY; delete process.env.OPENAI_API_KEY;
const test = require('node:test'); const assert = require('node:assert/strict');
const express = require('express');
const fp = require('../src/featurePack');
test('tasks create/search/update/export and deterministic fallback preserve 0/false/empty', async () => {
  const store = fp.createTaskStore();
  const a = fp.createTask(store, 'u1', { title: 'Automate invoice approval', priority: 'high' });
  fp.createTask(store, 'u1', { title: 'Archive reports' });
  fp.createTask(store, 'u2', { title: 'Automate invoice approval' });
  assert.equal(fp.searchTasks(store.get('u1'), { q: 'invoice' }).length, 1);
  assert.equal(fp.searchTasks(store.get('u1'), { status: 'open' }).length, 2);
  assert.equal(fp.updateTask(store, 'u1', a.id, { status: 'done' }).status, 'done');
  assert.match(fp.toCsv(store.get('u1')), /Automate invoice approval/);
  const empty = fp.runFeature('prioritize', []);
  assert.equal(empty.aiGenerated, false); assert.match(empty.label, /Deterministic fallback/);
  assert.equal(empty.sections.find((s) => s.label === 'Total records').value, 0);
  assert.equal(empty.sections.find((s) => s.label === 'Has urgent items').value, false);
  assert.equal(empty.sections.find((s) => s.label === 'Top keyword').value, '');
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'u1' }; next(); });
  app.use('/api/feature-pack', fp.createFeaturePackRouter(store));
  const server = app.listen(0); const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const created = await (await fetch(`${base}/api/feature-pack/tasks`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'HTTP task' }) })).json();
    assert.ok(created.id);
    const csv = await (await fetch(`${base}/api/feature-pack/tasks/export?format=csv`)).text();
    assert.match(csv, /HTTP task/);
    const ai = await (await fetch(`${base}/api/feature-pack/ai/effort-estimate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).json();
    assert.equal(ai.aiGenerated, false);
  } finally { server.close(); }
});
