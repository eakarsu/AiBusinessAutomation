'use strict';
// FP wave 50A: authenticated tasks + search/filter + export + deterministic AI fallback.
// No provider calls: when no provider is configured the domain helpers below run
// deterministically over the caller's own task records and are labelled aiGenerated:false.
const express = require('express');
const FALLBACK_LABEL = 'Deterministic fallback — no AI provider configured';
function createTaskStore() { return new Map(); }
function ownerOf(req) { return String(req.user?.id || req.user?.subjectId || req.userId || req.auth?.userId || 'anonymous'); }
function listFor(store, owner) { if (!store.has(owner)) store.set(owner, []); return store.get(owner); }
function createTask(store, owner, body = {}) {
  const title = String(body.title || '').trim();
  if (!title) throw Object.assign(new Error('title_required'), { status: 422 });
  const task = { id: `task-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, title, description: String(body.description || ''), status: String(body.status || 'open'), priority: String(body.priority || 'normal'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  listFor(store, owner).push(task); return task;
}
function updateTask(store, owner, id, body = {}) {
  const task = listFor(store, owner).find((t) => t.id === id);
  if (!task) return null;
  for (const k of ['title', 'description', 'status', 'priority']) if (body[k] !== undefined) task[k] = String(body[k]);
  task.updatedAt = new Date().toISOString(); return task;
}
function searchTasks(tasks, { q = '', status = '', priority = '' } = {}) {
  const needle = String(q).toLowerCase();
  return tasks.filter((t) => (!needle || `${t.title} ${t.description}`.toLowerCase().includes(needle)) && (!status || t.status === status) && (!priority || t.priority === priority));
}
function toCsv(tasks) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return ['id,title,description,status,priority,createdAt,updatedAt', ...tasks.map((t) => [t.id, t.title, t.description, t.status, t.priority, t.createdAt, t.updatedAt].map(esc).join(','))].join('\n');
}
function sections(tasks) {
  const open = tasks.filter((t) => t.status !== 'done');
  const urgent = tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');
  const keywords = [...new Set(tasks.flatMap((t) => t.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3)))].slice(0, 5);
  return [
    { label: 'Total records', value: tasks.length },
    { label: 'Open records', value: open.length },
    { label: 'Has urgent items', value: urgent.length > 0 },
    { label: 'Top keyword', value: keywords[0] || '' },
    { label: 'Keywords', value: keywords },
    { label: 'Next open item', value: open[0]?.title || '' },
  ];
}
const FEATURES = {
  'prioritize': (tasks) => ({ feature: 'prioritize', summary: `Prioritized ${tasks.length} automation task(s) by priority and open status.`, sections: sections(tasks) }),
  'effort-estimate': (tasks) => ({ feature: 'effort-estimate', summary: `Estimated effort from ${tasks.length} task(s): open items need scheduling first.`, sections: sections(tasks) }),
  'next-actions': (tasks) => ({ feature: 'next-actions', summary: tasks.length ? `Next action: work on "${tasks.find((t) => t.status !== 'done')?.title || tasks[0].title}".` : 'Next action: create your first automation task.', sections: sections(tasks) }),
};
function runFeature(name, tasks) {
  const fn = FEATURES[name];
  if (!fn) return null;
  return { aiGenerated: false, source: 'deterministic-fallback', label: FALLBACK_LABEL, ...fn(tasks) };
}
function createFeaturePackRouter(store = createTaskStore()) {
  const router = express.Router();
  router.get('/tasks', (req, res) => { const tasks = searchTasks(listFor(store, ownerOf(req)), req.query); res.json({ data: tasks, total: tasks.length }); });
  router.get('/tasks/export', (req, res) => {
    const tasks = searchTasks(listFor(store, ownerOf(req)), req.query);
    if (String(req.query.format || 'json') === 'csv') { res.type('text/csv').send(toCsv(tasks)); return; }
    res.json({ data: tasks, total: tasks.length });
  });
  router.post('/tasks', (req, res, next) => { try { res.status(201).json(createTask(store, ownerOf(req), req.body)); } catch (e) { next(e); } });
  router.patch('/tasks/:id', (req, res) => { const t = updateTask(store, ownerOf(req), req.params.id, req.body); return t ? res.json(t) : res.status(404).json({ error: 'task_not_found' }); });
  router.post('/ai/:feature', (req, res) => { const out = runFeature(req.params.feature, listFor(store, ownerOf(req))); return out ? res.json(out) : res.status(404).json({ error: 'feature_not_found' }); });
  return router;
}
module.exports = { createTaskStore, createTask, updateTask, searchTasks, toCsv, runFeature, createFeaturePackRouter, FALLBACK_LABEL };
