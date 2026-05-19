/**
 * Custom Views — 4 components (2 VIZ + 2 NON-VIZ) consuming /api/custom-views.
 *
 *   VIZ:     ExecutionCountChart   — SVG bar chart of per-day execution counts
 *            BottleneckHeatmap     — SVG heatmap of step x time bucket latency
 *
 *   NON-VIZ: RunbookPdfExport      — POST form, downloads PDF blob
 *            RulesEditor           — CRUD UI for workflow trigger/action rules
 */
import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const ui = {
  card: { background: '#1e293b', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20, marginBottom: 16 },
  h2: { color: '#e2e8f0', margin: 0, marginBottom: 6 },
  sub: { color: '#94a3b8', marginTop: 0, marginBottom: 14, fontSize: 13 },
  input: { width: '100%', padding: 9, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#e2e8f0', marginBottom: 10, boxSizing: 'border-box' },
  textarea: { width: '100%', padding: 9, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#e2e8f0', marginBottom: 10, boxSizing: 'border-box', minHeight: 90, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 },
  btn: { padding: '9px 16px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnAlt: { padding: '8px 14px', background: 'rgba(99,102,241,0.18)', color: '#c7d2fe', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  btnDanger: { padding: '6px 12px', background: 'rgba(239,68,68,0.18)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 12 },
  pill: { display: 'inline-block', padding: '2px 8px', borderRadius: 10, background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', fontSize: 11, marginRight: 6 },
  err: { color: '#fca5a5', fontSize: 12, marginTop: 8 },
  ok:  { color: '#86efac', fontSize: 12, marginTop: 8 },
  label: { color: '#94a3b8', fontSize: 12, marginBottom: 4, display: 'block' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#e2e8f0' },
  th: { textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid rgba(99,102,241,0.25)', color: '#a5b4fc', fontWeight: 600 },
  td: { padding: '8px 6px', borderBottom: '1px solid rgba(99,102,241,0.1)', verticalAlign: 'top' },
};

// =========================================================================
// 1. VIZ — Execution Count Chart (SVG, grouped bars / stacked totals)
// =========================================================================
export function ExecutionCountChart() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const r = await api.get(`/custom-views/execution-count-chart?days=${days}`);
      setData(r.data);
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const dims = { w: 860, h: 280, pad: 40 };
  const totals = data?.totals_by_date || [];
  const maxY = Math.max(1, ...totals.map((t) => t.count));

  return (
    <div style={ui.card} data-testid="cv-execution-count">
      <h2 style={ui.h2}>Workflow Execution Count</h2>
      <p style={ui.sub}>Total workflow executions per day across all active workflows.</p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={ui.label}>Days:</span>
        <input style={{ ...ui.input, width: 90, marginBottom: 0 }} type="number" min="1" max="60"
               value={days} onChange={(e) => setDays(Number(e.target.value || 14))} />
        <button style={ui.btn} onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Update'}</button>
      </div>

      {err && <div style={ui.err}>{err}</div>}

      {data && (
        <>
          <div style={{ marginBottom: 10 }}>
            <span style={ui.pill}>total: {data.summary.grand_total.toLocaleString()}</span>
            <span style={ui.pill}>workflows: {data.summary.workflow_count}</span>
            <span style={ui.pill}>peak: {data.summary.peak_count} ({data.summary.peak_date})</span>
          </div>
          <div style={{ overflowX: 'auto', background: 'rgba(15,23,42,0.6)', borderRadius: 8, padding: 8 }}>
            <svg width={dims.w} height={dims.h} role="img" aria-label="execution count chart">
              {/* axes */}
              <line x1={dims.pad} y1={dims.h - dims.pad} x2={dims.w - dims.pad} y2={dims.h - dims.pad} stroke="#334155" />
              <line x1={dims.pad} y1={dims.pad} x2={dims.pad} y2={dims.h - dims.pad} stroke="#334155" />
              {/* gridlines */}
              {[0.25, 0.5, 0.75, 1].map((f, i) => {
                const y = dims.h - dims.pad - f * (dims.h - dims.pad * 2);
                return (
                  <g key={i}>
                    <line x1={dims.pad} y1={y} x2={dims.w - dims.pad} y2={y} stroke="#1e293b" />
                    <text x={dims.pad - 6} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10">
                      {Math.round(maxY * f)}
                    </text>
                  </g>
                );
              })}
              {/* bars */}
              {totals.map((t, i) => {
                const slot = (dims.w - dims.pad * 2) / Math.max(totals.length, 1);
                const x = dims.pad + i * slot + slot * 0.15;
                const w = slot * 0.7;
                const h = (t.count / maxY) * (dims.h - dims.pad * 2);
                return (
                  <g key={t.date}>
                    <rect x={x} y={dims.h - dims.pad - h} width={w} height={h} fill="#6366f1" opacity="0.85" />
                    {i % Math.ceil(totals.length / 8) === 0 && (
                      <text x={x + w / 2} y={dims.h - dims.pad + 14} textAnchor="middle" fill="#94a3b8" fontSize="10">
                        {t.date.slice(5)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text x={dims.pad} y={dims.pad - 10} fill="#94a3b8" fontSize="11">runs</text>
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

// =========================================================================
// 2. VIZ — Bottleneck Heatmap (SVG, step x time bucket)
// =========================================================================
export function BottleneckHeatmap() {
  const [workflowId, setWorkflowId] = useState(1);
  const [buckets, setBuckets] = useState(12);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const r = await api.get(`/custom-views/bottleneck-heatmap?workflow_id=${workflowId}&buckets=${buckets}`);
      setData(r.data);
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const cellLookup = useMemo(() => {
    const m = {};
    (data?.cells || []).forEach((c) => { m[`${c.step_id}|${c.bucket_index}`] = c; });
    return m;
  }, [data]);

  const colorFor = (sev) => {
    // green -> yellow -> red
    const r = Math.round(255 * Math.min(1, sev * 1.4));
    const g = Math.round(220 * Math.max(0, 1 - sev * 1.1));
    const b = 60;
    return `rgb(${r},${g},${b})`;
  };

  const cellW = 44, cellH = 30, padLeft = 110, padTop = 40;
  const cols = data?.bucket_labels?.length || 0;
  const rows = data?.steps?.length || 0;
  const svgW = padLeft + cols * cellW + 20;
  const svgH = padTop + rows * cellH + 20;

  return (
    <div style={ui.card} data-testid="cv-bottleneck-heatmap">
      <h2 style={ui.h2}>Bottleneck Heatmap (Step × Time)</h2>
      <p style={ui.sub}>Per-step latency by 2-hour time bucket. Hotter cells indicate bottlenecks.</p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={ui.label}>Workflow ID:</span>
        <input style={{ ...ui.input, width: 80, marginBottom: 0 }} type="number" value={workflowId}
               onChange={(e) => setWorkflowId(Number(e.target.value || 1))} />
        <span style={ui.label}>Buckets:</span>
        <input style={{ ...ui.input, width: 80, marginBottom: 0 }} type="number" value={buckets}
               onChange={(e) => setBuckets(Number(e.target.value || 12))} />
        <button style={ui.btn} onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Update'}</button>
      </div>

      {err && <div style={ui.err}>{err}</div>}

      {data && (
        <>
          <div style={{ overflowX: 'auto', background: 'rgba(15,23,42,0.6)', borderRadius: 8, padding: 8 }}>
            <svg width={svgW} height={svgH} role="img" aria-label="bottleneck heatmap">
              {/* bucket labels */}
              {data.bucket_labels.map((bl, i) => (
                <text key={bl + i} x={padLeft + i * cellW + cellW / 2} y={padTop - 10}
                      textAnchor="middle" fill="#94a3b8" fontSize="10">{bl}</text>
              ))}
              {/* step rows */}
              {data.steps.map((s, r) => (
                <g key={s.id}>
                  <text x={padLeft - 10} y={padTop + r * cellH + cellH / 2 + 4}
                        textAnchor="end" fill="#cbd5e1" fontSize="11">{s.label}</text>
                  {Array.from({ length: cols }).map((_, c) => {
                    const cell = cellLookup[`${s.id}|${c}`];
                    if (!cell) return null;
                    return (
                      <g key={c}>
                        <rect x={padLeft + c * cellW + 1} y={padTop + r * cellH + 1}
                              width={cellW - 2} height={cellH - 2}
                              fill={colorFor(cell.severity)} opacity="0.85">
                          <title>{`${s.label} @ ${data.bucket_labels[c]} — ${cell.latency_ms} ms`}</title>
                        </rect>
                        <text x={padLeft + c * cellW + cellW / 2} y={padTop + r * cellH + cellH / 2 + 4}
                              textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="600">
                          {cell.latency_ms}
                        </text>
                      </g>
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ ...ui.label, marginBottom: 6 }}>Top bottlenecks</div>
            <div>
              {data.top_bottlenecks.map((b, i) => (
                <span key={i} style={ui.pill}>{b.step} @ {b.bucket} — {b.latency_ms} ms</span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// =========================================================================
// 3. NON-VIZ — Automation Runbook PDF Export
// =========================================================================
export function RunbookPdfExport() {
  const [workflowId, setWorkflowId] = useState(1);
  const [workflowName, setWorkflowName] = useState('Invoice Approval Runbook');
  const [owner, setOwner] = useState('Operations Team');
  const [severity, setSeverity] = useState('medium');
  const [stepsRaw, setStepsRaw] = useState(
    'Detect trigger | Verify the event source and payload\n' +
    'Run extraction | Invoke AI extractor; record confidence\n' +
    'Route for approval | Apply business rules; escalate above threshold\n' +
    'Execute action | Invoke downstream system; capture transaction id\n' +
    'Notify stakeholders | Email or post to channel; attach evidence\n' +
    'Archive evidence | Persist artifacts with retention tag'
  );
  const [escalation, setEscalation] = useState('Page on-call SRE after 15 min unresolved. Escalate to Director of Ops after 30 min.');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const steps = stepsRaw.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
        const [title, detail = ''] = line.split('|').map((s) => s.trim());
        return { title, detail };
      });
      const r = await api.post(
        '/custom-views/runbook-pdf',
        { workflow_id: workflowId, workflow_name: workflowName, owner, severity, steps, escalation, notes },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `runbook-${workflowId}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setMsg(`Runbook PDF for workflow #${workflowId} downloaded.`);
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setBusy(false);
  };

  return (
    <div style={ui.card} data-testid="cv-runbook-pdf">
      <h2 style={ui.h2}>Automation Runbook PDF</h2>
      <p style={ui.sub}>Generate a printable runbook with steps, escalation path, and ownership.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={ui.label}>Workflow ID</label>
          <input style={ui.input} type="number" value={workflowId} onChange={(e) => setWorkflowId(Number(e.target.value || 1))} />
        </div>
        <div>
          <label style={ui.label}>Workflow Name</label>
          <input style={ui.input} value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} />
        </div>
        <div>
          <label style={ui.label}>Owner</label>
          <input style={ui.input} value={owner} onChange={(e) => setOwner(e.target.value)} />
        </div>
        <div>
          <label style={ui.label}>Severity</label>
          <select style={ui.input} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>
        </div>
      </div>

      <label style={ui.label}>Steps (one per line, "title | detail")</label>
      <textarea style={{ ...ui.textarea, minHeight: 140 }} value={stepsRaw} onChange={(e) => setStepsRaw(e.target.value)} />

      <label style={ui.label}>Escalation Path</label>
      <textarea style={ui.textarea} value={escalation} onChange={(e) => setEscalation(e.target.value)} />

      <label style={ui.label}>Notes (optional)</label>
      <textarea style={ui.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} />

      <button style={ui.btn} onClick={download} disabled={busy}>{busy ? 'Generating…' : 'Generate & Download PDF'}</button>
      {msg && <div style={ui.ok}>{msg}</div>}
      {err && <div style={ui.err}>{err}</div>}
    </div>
  );
}

// =========================================================================
// 4. NON-VIZ — Workflow Rules Editor (CRUD trigger/action)
// =========================================================================
export function RulesEditor() {
  const [rules, setRules] = useState([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    workflow: '', trigger_type: '', trigger_value: '',
    action_type: '', action_value: '', enabled: true,
  });
  const [editId, setEditId] = useState(null);

  const load = async () => {
    setLoading(true); setErr('');
    try {
      const r = await api.get('/custom-views/rules');
      setRules(r.data.rules || []);
    } catch (e) { setErr(e.response?.data?.error || e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ workflow: '', trigger_type: '', trigger_value: '', action_type: '', action_value: '', enabled: true });
    setEditId(null);
  };

  const submit = async () => {
    setErr(''); setMsg('');
    try {
      if (editId == null) {
        await api.post('/custom-views/rules', form);
        setMsg('Rule created.');
      } else {
        await api.put(`/custom-views/rules/${editId}`, form);
        setMsg(`Rule #${editId} updated.`);
      }
      resetForm();
      load();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
  };

  const beginEdit = (r) => {
    setEditId(r.id);
    setForm({
      workflow: r.workflow, trigger_type: r.trigger_type, trigger_value: r.trigger_value || '',
      action_type: r.action_type, action_value: r.action_value || '', enabled: !!r.enabled,
    });
  };

  const remove = async (id) => {
    setErr(''); setMsg('');
    try {
      await api.delete(`/custom-views/rules/${id}`);
      setMsg(`Rule #${id} deleted.`);
      load();
    } catch (e) { setErr(e.response?.data?.error || e.message); }
  };

  return (
    <div style={ui.card} data-testid="cv-rules-editor">
      <h2 style={ui.h2}>Workflow Rules Editor</h2>
      <p style={ui.sub}>Create, update, and delete trigger-to-action rules for any workflow.</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div>
          <label style={ui.label}>Workflow</label>
          <input style={ui.input} value={form.workflow}
                 onChange={(e) => setForm({ ...form, workflow: e.target.value })}
                 placeholder="e.g. Invoice Approval" />
        </div>
        <div>
          <label style={ui.label}>Trigger Type</label>
          <input style={ui.input} value={form.trigger_type}
                 onChange={(e) => setForm({ ...form, trigger_type: e.target.value })}
                 placeholder="e.g. email_received" />
        </div>
        <div>
          <label style={ui.label}>Trigger Value</label>
          <input style={ui.input} value={form.trigger_value}
                 onChange={(e) => setForm({ ...form, trigger_value: e.target.value })}
                 placeholder="e.g. invoice@company.com" />
        </div>
        <div>
          <label style={ui.label}>Action Type</label>
          <input style={ui.input} value={form.action_type}
                 onChange={(e) => setForm({ ...form, action_type: e.target.value })}
                 placeholder="e.g. route_approval" />
        </div>
        <div>
          <label style={ui.label}>Action Value</label>
          <input style={ui.input} value={form.action_value}
                 onChange={(e) => setForm({ ...form, action_value: e.target.value })}
                 placeholder="e.g. finance_director" />
        </div>
        <div>
          <label style={{ ...ui.label, marginTop: 22 }}>
            <input type="checkbox" checked={form.enabled}
                   onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> Enabled
          </label>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <button style={ui.btn} onClick={submit}>{editId == null ? 'Add Rule' : 'Save Changes'}</button>
        {editId != null && (
          <button style={{ ...ui.btnAlt, marginLeft: 8 }} onClick={resetForm}>Cancel</button>
        )}
        <button style={{ ...ui.btnAlt, marginLeft: 8 }} onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {msg && <div style={ui.ok}>{msg}</div>}
      {err && <div style={ui.err}>{err}</div>}

      <table style={ui.table}>
        <thead>
          <tr>
            <th style={ui.th}>ID</th>
            <th style={ui.th}>Workflow</th>
            <th style={ui.th}>Trigger</th>
            <th style={ui.th}>Action</th>
            <th style={ui.th}>Enabled</th>
            <th style={ui.th}></th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td style={ui.td}>{r.id}</td>
              <td style={ui.td}>{r.workflow}</td>
              <td style={ui.td}>{r.trigger_type}{r.trigger_value ? `: ${r.trigger_value}` : ''}</td>
              <td style={ui.td}>{r.action_type}{r.action_value ? `: ${r.action_value}` : ''}</td>
              <td style={ui.td}>{r.enabled ? 'yes' : 'no'}</td>
              <td style={ui.td}>
                <button style={ui.btnAlt} onClick={() => beginEdit(r)}>Edit</button>
                <button style={{ ...ui.btnDanger, marginLeft: 6 }} onClick={() => remove(r.id)}>Delete</button>
              </td>
            </tr>
          ))}
          {!rules.length && (
            <tr><td colSpan="6" style={{ ...ui.td, color: '#64748b' }}>No rules yet — add your first one above.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
