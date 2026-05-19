/**
 * Pages for the audit's NEW proposed features + production improvement modules.
 *  - WorkflowTriggersPage
 *  - BottleneckHeatmapPage
 *  - AnomalyDetectionPage
 *  - WorkflowBuilderPage
 *  - ComplianceWatchdogPage
 *  - ProcessAnalyticsPage  (existing /api/analytics/processes)
 *  - NotificationsPage     (existing /api/notifications/send)
 *  - AIStreamPage          (existing /api/ai/...stream)
 */
import React, { useEffect, useState } from 'react';
import api from '../services/api';

const card = { background: '#1e293b', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 12, padding: 20, marginBottom: 16 };
const input = { width: '100%', padding: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, color: '#e2e8f0', marginBottom: 12 };
const btn = { padding: '10px 18px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 };
const h1 = { color: '#e2e8f0', marginBottom: 8 };
const subText = { color: '#94a3b8', marginBottom: 16 };
const pre = { background: 'rgba(15,23,42,0.6)', padding: 16, borderRadius: 8, color: '#cbd5e1', whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 400, overflow: 'auto' };

function Spinner() {
  return <div style={{ color: '#94a3b8', padding: 20 }}>Loading...</div>;
}

// =========================================================================
// 1. Workflow Triggers Page
// =========================================================================
export function WorkflowTriggersPage() {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ workflow_id: '', trigger_type: 'cron', schedule_or_condition: '', action: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/proposed/workflow-triggers');
      setTriggers(r.data.triggers || []);
    } catch (e) { setMsg(e.response?.data?.error || e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setSaving(true); setMsg('');
    try {
      await api.post('/proposed/workflow-triggers', form);
      setForm({ workflow_id: '', trigger_type: 'cron', schedule_or_condition: '', action: '' });
      load();
      setMsg('Trigger created.');
    } catch (e) { setMsg(e.response?.data?.error || JSON.stringify(e.response?.data?.errors) || e.message); }
    setSaving(false);
  };

  const fire = async (id) => {
    try {
      const r = await api.post(`/proposed/workflow-triggers/${id}/fire`);
      setMsg(r.data.message);
      load();
    } catch (e) { setMsg(e.response?.data?.error || e.message); }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>⏰ Workflow Trigger Engine</h1>
      <p style={subText}>Define cron/condition/event triggers that automatically fire workflow actions.</p>

      <div style={card}>
        <h3 style={{ color: '#e2e8f0' }}>+ New Trigger</h3>
        <input style={input} placeholder="Workflow ID" value={form.workflow_id} onChange={e => setForm({ ...form, workflow_id: e.target.value })} />
        <select style={input} value={form.trigger_type} onChange={e => setForm({ ...form, trigger_type: e.target.value })}>
          <option value="cron">cron</option>
          <option value="condition">condition</option>
          <option value="event">event</option>
        </select>
        <input style={input} placeholder="Schedule (cron expression) or condition" value={form.schedule_or_condition} onChange={e => setForm({ ...form, schedule_or_condition: e.target.value })} />
        <input style={input} placeholder="Action (e.g. send_email, create_task, update_record)" value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} />
        <button style={btn} onClick={create} disabled={saving}>{saving ? 'Saving...' : 'Create Trigger'}</button>
        {msg && <p style={{ color: '#a5b4fc', marginTop: 12 }}>{msg}</p>}
      </div>

      <div style={card}>
        <h3 style={{ color: '#e2e8f0' }}>Existing Triggers</h3>
        {loading ? <Spinner /> : triggers.length === 0 ? <p style={subText}>No triggers yet.</p> : (
          <table style={{ width: '100%', color: '#e2e8f0' }}>
            <thead><tr style={{ textAlign: 'left', color: '#94a3b8' }}>
              <th>ID</th><th>Workflow</th><th>Type</th><th>Schedule/Condition</th><th>Action</th><th>Fires</th><th>Last Fired</th><th></th>
            </tr></thead>
            <tbody>
              {triggers.map(t => (
                <tr key={t.id} style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
                  <td>{t.id}</td><td>{t.workflow_id}</td><td>{t.trigger_type}</td>
                  <td><code style={{ color: '#a5b4fc' }}>{t.schedule_or_condition}</code></td>
                  <td>{t.action}</td><td>{t.fire_count || 0}</td>
                  <td>{t.last_fired_at ? new Date(t.last_fired_at).toLocaleString() : '—'}</td>
                  <td><button style={{ ...btn, padding: '6px 12px' }} onClick={() => fire(t.id)}>Fire</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// 2. Bottleneck Heatmap Page
// =========================================================================
export function BottleneckHeatmapPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/proposed/bottleneck-heatmap')
      .then(r => setData(r.data))
      .catch(() => setData({ heatmap: [] }))
      .finally(() => setLoading(false));
  }, []);

  const colorFor = (i) => i >= 75 ? '#ef4444' : i >= 50 ? '#f97316' : i >= 25 ? '#eab308' : '#22c55e';

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>🔥 AI Bottleneck Heatmap</h1>
      <p style={subText}>Aggregated process-mining results show where bottlenecks recur across departments.</p>

      {loading ? <Spinner /> : (
        <div style={card}>
          {data?.heatmap?.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {data.heatmap.map((r, i) => (
                <div key={i} style={{
                  borderRadius: 10,
                  padding: 14,
                  background: `linear-gradient(135deg, ${colorFor(r.intensity)}40, ${colorFor(r.intensity)}10)`,
                  border: `1px solid ${colorFor(r.intensity)}80`,
                }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{r.department}</div>
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>{r.process_type} · {r.complexity}</div>
                  <div style={{ marginTop: 8, color: colorFor(r.intensity), fontSize: 24, fontWeight: 700 }}>{r.intensity}%</div>
                  <div style={{ color: '#94a3b8', fontSize: 11 }}>{r.bottleneck_count}/{r.process_count} processes</div>
                </div>
              ))}
            </div>
          ) : (
            <p style={subText}>No analyzed processes yet. Run AI analysis on Process Mining items first.</p>
          )}
          {data?.legend && <p style={{ ...subText, marginTop: 16, fontSize: 12 }}>{data.legend}</p>}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 3. Anomaly Detection Page
// =========================================================================
export function AnomalyDetectionPage() {
  const [form, setForm] = useState({ amount: '', category: '', vendor: '' });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true); setResult(null);
    try {
      const r = await api.post('/proposed/anomaly-check', { amount: parseFloat(form.amount), category: form.category, vendor: form.vendor });
      setResult(r.data);
    } catch (e) { setResult({ error: e.response?.data?.error || e.message }); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>🚨 Live Expense Anomaly Detection</h1>
      <p style={subText}>Compare a new expense against the 90-day rolling history. Flags z-score &gt; 2 or +40% over avg.</p>

      <div style={card}>
        <input style={input} placeholder="Amount (USD)" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
        <input style={input} placeholder="Category (must match an expenses.category)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
        <input style={input} placeholder="Vendor (optional)" value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
        <button style={btn} onClick={check} disabled={loading || !form.amount || !form.category}>
          {loading ? 'Checking...' : 'Run Anomaly Check'}
        </button>
      </div>

      {result && (
        <div style={card}>
          <h3 style={{ color: result.is_anomaly ? '#ef4444' : '#22c55e' }}>
            {result.is_anomaly ? '⚠ Anomaly detected' : '✓ Within normal range'}
          </h3>
          <pre style={pre}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 4. Workflow Builder Page (NL → workflow)
// =========================================================================
export function WorkflowBuilderPage() {
  const [description, setDescription] = useState('');
  const [save, setSave] = useState(false);
  const [out, setOut] = useState(null);
  const [loading, setLoading] = useState(false);

  const build = async () => {
    setLoading(true); setOut(null);
    try {
      const r = await api.post('/proposed/workflow-builder', { description, save });
      setOut(r.data);
    } catch (e) { setOut({ error: e.response?.data?.error || e.message }); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>💬 Natural-Language Workflow Builder</h1>
      <p style={subText}>Describe a business process in plain English; AI proposes a structured workflow.</p>

      <div style={card}>
        <textarea
          style={{ ...input, minHeight: 120 }}
          placeholder='e.g. "When a vendor invoice arrives by email, classify it, route to AP for review, request approval if &gt; $10k, then schedule payment 30 days out."'
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
        <label style={{ color: '#cbd5e1', display: 'block', marginBottom: 12 }}>
          <input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)} /> Save as draft workflow
        </label>
        <button style={btn} onClick={build} disabled={loading || !description.trim()}>
          {loading ? 'Building...' : 'Build Workflow'}
        </button>
      </div>

      {out && (
        <div style={card}>
          <h3 style={{ color: '#e2e8f0' }}>Result</h3>
          {out.parsed && (
            <div>
              <h4 style={{ color: '#a5b4fc' }}>Parsed</h4>
              <pre style={pre}>{JSON.stringify(out.parsed, null, 2)}</pre>
            </div>
          )}
          {out.saved && (
            <div>
              <h4 style={{ color: '#a5b4fc' }}>Saved</h4>
              <pre style={pre}>{JSON.stringify(out.saved, null, 2)}</pre>
            </div>
          )}
          {out.raw_ai_output && (
            <div>
              <h4 style={{ color: '#a5b4fc' }}>Raw AI output</h4>
              <pre style={pre}>{out.raw_ai_output}</pre>
            </div>
          )}
          {out.error && <p style={{ color: '#ef4444' }}>{out.error}</p>}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 5. Compliance Watchdog Page
// =========================================================================
export function ComplianceWatchdogPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memo, setMemo] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/proposed/compliance-watchdog?days_ahead=${days}`);
      setData(r.data);
    } catch (e) { setData({ upcoming_deadlines: [], summary: {} }); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const draftMemo = async (id) => {
    setMemo({ id, loading: true });
    try {
      const r = await api.post(`/proposed/compliance-watchdog/${id}/draft-memo`);
      setMemo({ id, memo: r.data.memo });
    } catch (e) { setMemo({ id, error: e.response?.data?.error || e.message }); }
  };

  const colorFor = (u) => u === 'red' ? '#ef4444' : u === 'orange' ? '#f97316' : u === 'yellow' ? '#eab308' : '#22c55e';

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>🛡️ Compliance Deadline Watchdog</h1>
      <p style={subText}>Show upcoming compliance deadlines; auto-draft remediation memos.</p>

      <div style={card}>
        <label style={{ color: '#cbd5e1', display: 'block', marginBottom: 8 }}>Window (days ahead):</label>
        <input style={{ ...input, width: 120 }} type="number" value={days} onChange={e => setDays(parseInt(e.target.value) || 30)} />
        <button style={btn} onClick={load}>Refresh</button>
      </div>

      {loading ? <Spinner /> : (
        <div style={card}>
          <div style={{ marginBottom: 12, color: '#94a3b8' }}>
            Total: {data?.summary?.total || 0} ·
            <span style={{ color: '#ef4444' }}> Red: {data?.summary?.red || 0}</span> ·
            <span style={{ color: '#f97316' }}> Orange: {data?.summary?.orange || 0}</span> ·
            <span style={{ color: '#eab308' }}> Yellow: {data?.summary?.yellow || 0}</span>
          </div>
          {(data?.upcoming_deadlines || []).length === 0 ? (
            <p style={subText}>No upcoming compliance deadlines.</p>
          ) : (
            <table style={{ width: '100%', color: '#e2e8f0', borderCollapse: 'collapse' }}>
              <thead><tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                <th>Title</th><th>Regulation</th><th>Due</th><th>Days</th><th>Owner</th><th></th>
              </tr></thead>
              <tbody>
                {data.upcoming_deadlines.map(item => (
                  <tr key={item.id} style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
                    <td>{item.title}</td>
                    <td>{item.regulation_type}</td>
                    <td>{item.due_date ? new Date(item.due_date).toLocaleDateString() : '—'}</td>
                    <td><span style={{ color: colorFor(item.urgency), fontWeight: 700 }}>{item.days_left}</span></td>
                    <td>{item.responsible_party}</td>
                    <td><button style={{ ...btn, padding: '6px 12px' }} onClick={() => draftMemo(item.id)}>AI Draft Memo</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {memo && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ color: '#a5b4fc' }}>Memo for compliance #{memo.id}</h4>
              {memo.loading ? <Spinner /> : memo.error ? <p style={{ color: '#ef4444' }}>{memo.error}</p> : <pre style={pre}>{memo.memo}</pre>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 6. Process Analytics Page (existing /api/analytics/processes)
// =========================================================================
export function ProcessAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hourlyRate, setHourlyRate] = useState(75);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/analytics/processes?hourly_rate=${hourlyRate}`);
      setData(r.data);
    } catch (e) { setData(null); }
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>📈 Process Analytics</h1>
      <p style={subText}>Workflow & process automation KPIs, ROI, and exception rates.</p>

      <div style={card}>
        <label style={{ color: '#cbd5e1' }}>Hourly rate ($): </label>
        <input style={{ ...input, width: 120, display: 'inline-block', marginLeft: 8 }} type="number" value={hourlyRate} onChange={e => setHourlyRate(parseInt(e.target.value) || 75)} />
        <button style={{ ...btn, marginLeft: 8 }} onClick={load}>Refresh</button>
      </div>

      {loading ? <Spinner /> : !data ? <p style={subText}>No data.</p> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <KPI label="Total workflows" value={data.summary?.total_workflows} />
            <KPI label="Active workflows" value={data.summary?.active_workflows} />
            <KPI label="Processes analyzed" value={data.summary?.total_processes_analyzed} />
            <KPI label="Tasks completed" value={data.summary?.completed_tasks} />
            <KPI label="Automation rate" value={`${data.summary?.automation_rate_pct || 0}%`} />
            <KPI label="ROI (USD est.)" value={`$${(data.roi?.estimated_value_usd || 0).toLocaleString()}`} accent="#22c55e" />
          </div>

          <div style={card}>
            <h3 style={{ color: '#e2e8f0' }}>Cycle time by process type</h3>
            <table style={{ width: '100%', color: '#e2e8f0' }}>
              <thead><tr style={{ textAlign: 'left', color: '#94a3b8' }}><th>Type</th><th>Count</th><th>Avg cycle (h)</th></tr></thead>
              <tbody>
                {(data.cycle_times_by_process_type || []).map((c, i) => (
                  <tr key={i}><td>{c.process_type}</td><td>{c.count}</td><td>{c.avg_cycle_hours}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={card}>
            <h3 style={{ color: '#e2e8f0' }}>Top exception rates by workflow</h3>
            <table style={{ width: '100%', color: '#e2e8f0' }}>
              <thead><tr style={{ textAlign: 'left', color: '#94a3b8' }}><th>Workflow</th><th>Exceptions</th><th>Rate %</th></tr></thead>
              <tbody>
                {(data.exception_rates_by_workflow || []).map(r => (
                  <tr key={r.workflow_id}><td>{r.workflow_name}</td><td>{r.exception_count}</td><td>{r.exception_rate_pct}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function KPI({ label, value, accent = '#a5b4fc' }) {
  return (
    <div style={card}>
      <div style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: accent, fontSize: 28, fontWeight: 700, marginTop: 4 }}>{value ?? '—'}</div>
    </div>
  );
}

// =========================================================================
// 7. Notifications Page (existing /api/notifications/send)
// =========================================================================
export function NotificationsPage() {
  const [type, setType] = useState('workflow_completed');
  const [to, setTo] = useState('');
  const [payload, setPayload] = useState('{}');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true); setResult(null);
    try {
      let pl = {};
      try { pl = JSON.parse(payload || '{}'); } catch (_) { setResult({ error: 'payload must be valid JSON' }); setLoading(false); return; }
      const r = await api.post('/notifications/send', { type, to, payload: pl });
      setResult(r.data);
    } catch (e) { setResult({ error: e.response?.data?.error || JSON.stringify(e.response?.data?.errors) || e.message }); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>🔔 Notifications</h1>
      <p style={subText}>Send workflow_completed / approval_needed / process_anomaly / custom email notifications.</p>

      <div style={card}>
        <select style={input} value={type} onChange={e => setType(e.target.value)}>
          <option value="workflow_completed">workflow_completed</option>
          <option value="approval_needed">approval_needed</option>
          <option value="process_anomaly">process_anomaly</option>
          <option value="custom">custom</option>
        </select>
        <input style={input} placeholder="to (recipient email)" value={to} onChange={e => setTo(e.target.value)} />
        <textarea style={{ ...input, minHeight: 140, fontFamily: 'monospace' }} placeholder='Payload as JSON e.g. {"workflowName":"Invoice Reconciliation"}' value={payload} onChange={e => setPayload(e.target.value)} />
        <button style={btn} onClick={send} disabled={loading || !to}>{loading ? 'Sending...' : 'Send Notification'}</button>
      </div>
      {result && <div style={card}><pre style={pre}>{JSON.stringify(result, null, 2)}</pre></div>}
    </div>
  );
}

// =========================================================================
// 8. AI Stream Page (process description streaming + RPA gen)
// =========================================================================
export function AIStreamPage() {
  const [tab, setTab] = useState('analyze');
  const [text, setText] = useState('');
  const [out, setOut] = useState('');
  const [loading, setLoading] = useState(false);
  const [rpaForm, setRpaForm] = useState({ name: '', task_description: '', platform: 'UiPath' });

  const stream = async () => {
    setLoading(true); setOut('');
    const token = localStorage.getItem('token');
    const url = `${api.defaults.baseURL}/ai/analyze-process/stream?description=${encodeURIComponent(text)}`;
    try {
      const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        // SSE chunks come in "data: {...}" lines
        chunk.split('\n').forEach(line => {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.token) setOut(prev => prev + payload.token);
              if (payload.content) setOut(prev => prev + payload.content);
            } catch (_) {}
          }
        });
      }
    } catch (e) {
      setOut('Error: ' + e.message);
    }
    setLoading(false);
  };

  const analyzeOnce = async () => {
    setLoading(true); setOut('');
    try {
      const r = await api.post('/ai/analyze-process-description', { description: text });
      setOut(r.data?.analysis || JSON.stringify(r.data, null, 2));
    } catch (e) { setOut('Error: ' + (e.response?.data?.error || e.message)); }
    setLoading(false);
  };

  const generateRpa = async () => {
    setLoading(true); setOut('');
    try {
      const r = await api.post('/ai/generate-rpa', rpaForm);
      setOut(r.data?.script || r.data?.code || JSON.stringify(r.data, null, 2));
    } catch (e) { setOut('Error: ' + (e.response?.data?.error || e.message)); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>🌊 AI Streaming Tools</h1>
      <p style={subText}>Live SSE streaming process analysis + RPA script generation.</p>

      <div style={card}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button style={{ ...btn, opacity: tab === 'analyze' ? 1 : 0.6 }} onClick={() => setTab('analyze')}>Process Analysis (stream)</button>
          <button style={{ ...btn, opacity: tab === 'once' ? 1 : 0.6 }} onClick={() => setTab('once')}>Process Analysis (one-shot)</button>
          <button style={{ ...btn, opacity: tab === 'rpa' ? 1 : 0.6 }} onClick={() => setTab('rpa')}>RPA Script Generator</button>
        </div>

        {tab !== 'rpa' ? (
          <>
            <textarea style={{ ...input, minHeight: 120 }} placeholder="Describe a business process..." value={text} onChange={e => setText(e.target.value)} />
            <button style={btn} onClick={tab === 'analyze' ? stream : analyzeOnce} disabled={loading || !text.trim()}>
              {loading ? 'Working...' : tab === 'analyze' ? 'Stream Analyze' : 'Analyze'}
            </button>
          </>
        ) : (
          <>
            <input style={input} placeholder="Script name" value={rpaForm.name} onChange={e => setRpaForm({ ...rpaForm, name: e.target.value })} />
            <textarea style={{ ...input, minHeight: 100 }} placeholder="Task description" value={rpaForm.task_description} onChange={e => setRpaForm({ ...rpaForm, task_description: e.target.value })} />
            <select style={input} value={rpaForm.platform} onChange={e => setRpaForm({ ...rpaForm, platform: e.target.value })}>
              <option>UiPath</option><option>Blue Prism</option><option>Automation Anywhere</option><option>Power Automate</option><option>Python</option>
            </select>
            <button style={btn} onClick={generateRpa} disabled={loading || !rpaForm.task_description}>{loading ? 'Generating...' : 'Generate RPA Script'}</button>
          </>
        )}
      </div>

      {out && <div style={card}><pre style={pre}>{out}</pre></div>}
    </div>
  );
}

// =========================================================================
// 9. Webhooks Page
// =========================================================================
const ALLOWED_WEBHOOK_EVENTS = [
  'workflow.started',
  'workflow.completed',
  'workflow.failed',
  'approval.requested',
  'approval.granted',
  'approval.rejected',
  'document.uploaded',
  'invoice.processed',
  'task.assigned',
  'compliance.alert',
  'exception.raised',
];

export function WebhooksPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ url: '', secret: '', events: ['workflow.started'] });
  const [msg, setMsg] = useState('');
  const [testResult, setTestResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/webhooks');
      setItems(Array.isArray(r.data) ? r.data : (r.data?.data || []));
    } catch (e) { setMsg(e.response?.data?.error || e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggleEvent = (ev) => {
    setForm((f) => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter((e) => e !== ev) : [...f.events, ev],
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.url) { setMsg('URL is required'); return; }
    if (form.events.length === 0) { setMsg('Select at least one event'); return; }
    setCreating(true); setMsg('');
    try {
      await api.post('/webhooks', { url: form.url, events: form.events, secret: form.secret || null });
      setForm({ url: '', secret: '', events: ['workflow.started'] });
      load();
      setMsg('Webhook created.');
    } catch (e) { setMsg(e.response?.data?.error || e.message); }
    setCreating(false);
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this webhook?')) return;
    try {
      await api.delete(`/webhooks/${id}`);
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch (e) { setMsg(e.response?.data?.error || e.message); }
  };

  const test = async (id) => {
    setTestResult(null);
    try {
      const r = await api.post(`/webhooks/${id}/test`);
      setTestResult(r.data);
    } catch (e) { setMsg(e.response?.data?.error || e.message); }
  };

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>{'\u{1F514}'} Webhook Subscriptions</h1>
      <p style={subText}>Subscribe external systems to workflow / approval / document events.</p>

      <div style={card}>
        <h3 style={{ color: '#e2e8f0' }}>+ New Subscription</h3>
        <form onSubmit={submit}>
          <input style={input} type="url" placeholder="https://example.com/hooks/biz-auto" value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })} required />
          <input style={input} type="text" placeholder="Signing Secret (optional)" value={form.secret}
            onChange={(e) => setForm({ ...form, secret: e.target.value })} />
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: '#cbd5e1', marginBottom: 6 }}>Events</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALLOWED_WEBHOOK_EVENTS.map((ev) => (
                <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#cbd5e1', fontSize: 13 }}>
                  <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} />
                  <span>{ev}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" style={btn} disabled={creating}>{creating ? 'Creating...' : 'Create Subscription'}</button>
        </form>
      </div>

      {msg && <div style={{ ...card, color: '#fbbf24' }}>{msg}</div>}

      <div style={card}>
        <h3 style={{ color: '#e2e8f0' }}>Active Webhooks</h3>
        {loading && <Spinner />}
        {!loading && items.length === 0 && <p style={{ color: '#94a3b8' }}>No webhooks subscribed yet.</p>}
        {!loading && items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', color: '#cbd5e1', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid rgba(99,102,241,0.2)' }}>ID</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid rgba(99,102,241,0.2)' }}>URL</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid rgba(99,102,241,0.2)' }}>Events</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid rgba(99,102,241,0.2)' }}>Active</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid rgba(99,102,241,0.2)' }}>Created</th>
                <th style={{ textAlign: 'left', padding: 6, borderBottom: '1px solid rgba(99,102,241,0.2)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td style={{ padding: 6 }}>{w.id}</td>
                  <td style={{ padding: 6, wordBreak: 'break-all', maxWidth: 280 }}>{w.url}</td>
                  <td style={{ padding: 6, fontSize: 11 }}>{(w.events || []).join(', ')}</td>
                  <td style={{ padding: 6 }}>{w.active ? 'Yes' : 'No'}</td>
                  <td style={{ padding: 6 }}>{w.created_at ? new Date(w.created_at).toLocaleString() : ''}</td>
                  <td style={{ padding: 6 }}>
                    <button style={{ ...btn, padding: '4px 10px', marginRight: 6, fontSize: 12 }} onClick={() => test(w.id)}>Test</button>
                    <button style={{ ...btn, padding: '4px 10px', background: '#ef4444', fontSize: 12 }} onClick={() => remove(w.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {testResult && (
        <div style={card}>
          <h3 style={{ color: '#e2e8f0' }}>Test Payload</h3>
          <pre style={pre}>{JSON.stringify(testResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// 10. AI Toolbox Page (generic /api/ai/* endpoints not bound to a record)
// =========================================================================
//
// Surfaces the generic AI helpers in backend/src/routes/ai.js that aren't
// addressable from the per-record DetailPage flow (chat, suggest-workflow,
// generate-agenda, etc.). Uses the same axios client (Bearer token via
// services/api interceptor) and renders the JSON response. A 503 from the
// backend indicates OPENROUTER_API_KEY is unset.
// =========================================================================

const AI_TOOLS = [
  {
    key: 'chat',
    label: 'AI Chat',
    path: '/ai/chat',
    fields: [
      { name: 'prompt', label: 'Prompt', type: 'textarea', required: true },
      { name: 'context', label: 'System Context (optional)', type: 'textarea' },
    ],
    resultKey: 'response',
  },
  {
    key: 'analyze-document',
    label: 'Analyze Document',
    path: '/ai/analyze-document',
    fields: [
      { name: 'content', label: 'Document Content', type: 'textarea', required: true },
    ],
    resultKey: 'analysis',
  },
  {
    key: 'analyze-contract',
    label: 'Analyze Contract',
    path: '/ai/analyze-contract',
    fields: [
      { name: 'content', label: 'Contract Text', type: 'textarea', required: true },
    ],
    resultKey: 'analysis',
  },
  {
    key: 'categorize-email',
    label: 'Categorize Email',
    path: '/ai/categorize-email',
    fields: [
      { name: 'subject', label: 'Subject', type: 'text', required: true },
      { name: 'body', label: 'Body', type: 'textarea', required: true },
    ],
    resultKey: 'analysis',
  },
  {
    key: 'suggest-workflow',
    label: 'Suggest Workflow',
    path: '/ai/suggest-workflow',
    fields: [
      { name: 'description', label: 'What should the workflow do?', type: 'textarea', required: true },
    ],
    resultKey: 'suggestion',
  },
  {
    key: 'analyze-expense',
    label: 'Analyze Expense',
    path: '/ai/analyze-expense',
    fields: [
      { name: 'description', label: 'Description', type: 'text', required: true },
      { name: 'amount', label: 'Amount (USD)', type: 'number', required: true },
      { name: 'category', label: 'Category', type: 'text', required: true },
    ],
    resultKey: 'analysis',
  },
  {
    key: 'generate-agenda',
    label: 'Generate Meeting Agenda',
    path: '/ai/generate-agenda',
    fields: [
      { name: 'topic', label: 'Topic', type: 'text', required: true },
      { name: 'participants', label: 'Participants (comma-separated)', type: 'text', required: true },
      { name: 'duration', label: 'Duration (minutes)', type: 'number', required: true },
    ],
    resultKey: 'agenda',
  },
  {
    key: 'prioritize-ticket',
    label: 'Prioritize Ticket',
    path: '/ai/prioritize-ticket',
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea', required: true },
    ],
    resultKey: 'analysis',
  },
  {
    key: 'analyze-compliance',
    label: 'Analyze Compliance',
    path: '/ai/analyze-compliance',
    fields: [
      { name: 'requirement', label: 'Requirement', type: 'textarea', required: true },
      { name: 'currentState', label: 'Current State', type: 'textarea', required: true },
    ],
    resultKey: 'analysis',
  },
  {
    key: 'evaluate-vendor',
    label: 'Evaluate Vendor',
    path: '/ai/evaluate-vendor',
    fields: [
      { name: 'vendorName', label: 'Vendor Name', type: 'text', required: true },
      { name: 'criteria', label: 'Criteria', type: 'textarea', required: true },
    ],
    resultKey: 'evaluation',
  },
  {
    key: 'generate-report',
    label: 'Generate Report',
    path: '/ai/generate-report',
    fields: [
      { name: 'dataDescription', label: 'Data Description', type: 'textarea', required: true },
      { name: 'reportType', label: 'Report Type', type: 'text', required: true },
    ],
    resultKey: 'report',
  },
  {
    key: 'suggest-onboarding',
    label: 'Suggest Onboarding Tasks',
    path: '/ai/suggest-onboarding',
    fields: [
      { name: 'role', label: 'Role', type: 'text', required: true },
      { name: 'department', label: 'Department', type: 'text', required: true },
    ],
    resultKey: 'suggestion',
  },
  {
    key: 'extract-data',
    label: 'Extract Data',
    path: '/ai/extract-data',
    fields: [
      { name: 'text', label: 'Source Text', type: 'textarea', required: true },
      { name: 'fields', label: 'Fields (comma-separated)', type: 'text', required: true },
    ],
    resultKey: 'extracted',
    transform: (form) => ({
      text: form.text,
      fields: String(form.fields || '').split(',').map((s) => s.trim()).filter(Boolean),
    }),
  },
  {
    key: 'suggest-approval-chain',
    label: 'Suggest Approval Chain',
    path: '/ai/suggest-approval-chain',
    fields: [
      { name: 'requestType', label: 'Request Type', type: 'text', required: true },
      { name: 'amount', label: 'Amount', type: 'number', required: true },
    ],
    resultKey: 'suggestion',
  },
];

export function AIToolboxPage() {
  const [activeKey, setActiveKey] = useState(AI_TOOLS[0].key);
  const [forms, setForms] = useState({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const tool = AI_TOOLS.find((t) => t.key === activeKey) || AI_TOOLS[0];
  const form = forms[activeKey] || {};

  const updateField = (name, value) => {
    setForms((prev) => ({ ...prev, [activeKey]: { ...(prev[activeKey] || {}), [name]: value } }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setResult(null);

    // Required check (client-side)
    for (const f of tool.fields) {
      if (f.required && !form[f.name]) {
        setError(`${f.label} is required.`);
        return;
      }
    }

    // Transform numeric fields and apply per-tool transform
    let body = {};
    for (const f of tool.fields) {
      const v = form[f.name];
      if (v === undefined || v === '') continue;
      body[f.name] = f.type === 'number' ? Number(v) : v;
    }
    if (typeof tool.transform === 'function') {
      body = tool.transform(body);
    }

    setLoading(true);
    try {
      const r = await api.post(tool.path, body);
      setResult(r.data);
    } catch (e) {
      const status = e.response?.status;
      const data = e.response?.data;
      if (status === 503) {
        setError('AI service unavailable. Set OPENROUTER_API_KEY on the server and retry.');
      } else if (data?.errors) {
        setError(data.errors.map((x) => x.msg || x.message || JSON.stringify(x)).join('; '));
      } else {
        setError(data?.error || e.message);
      }
    }
    setLoading(false);
  };

  // Pull a friendly preview from the response
  const preview = (() => {
    if (!result) return null;
    const v = result[tool.resultKey];
    if (typeof v === 'string') return v;
    return JSON.stringify(result, null, 2);
  })();

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>{'\u{1F9E0}'} AI Toolbox</h1>
      <p style={subText}>Direct access to the generic <code>/api/ai/*</code> helpers — chat, document/contract analysis, expense review, agenda generation, vendor evaluation, and more. Each call is authenticated and persisted to <code>ai_results</code>.</p>

      <div style={card}>
        <div style={{ color: '#cbd5e1', marginBottom: 8 }}>Tool</div>
        <select
          style={input}
          value={activeKey}
          onChange={(e) => { setActiveKey(e.target.value); setResult(null); setError(''); }}
        >
          {AI_TOOLS.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>

        <form onSubmit={submit}>
          {tool.fields.map((f) => (
            <div key={f.name} style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', color: '#cbd5e1', marginBottom: 4, fontSize: 13 }}>
                {f.label}{f.required ? ' *' : ''}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  style={{ ...input, minHeight: 100 }}
                  value={form[f.name] || ''}
                  onChange={(e) => updateField(f.name, e.target.value)}
                  required={f.required}
                />
              ) : (
                <input
                  style={input}
                  type={f.type || 'text'}
                  value={form[f.name] || ''}
                  onChange={(e) => updateField(f.name, e.target.value)}
                  required={f.required}
                />
              )}
            </div>
          ))}
          <button type="submit" style={btn} disabled={loading}>
            {loading ? 'Working...' : `Run ${tool.label}`}
          </button>
        </form>
      </div>

      {error && (
        <div style={{ ...card, color: '#fca5a5', borderColor: 'rgba(239,68,68,0.4)' }}>
          {error}
        </div>
      )}

      {result && (
        <div style={card}>
          <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Result</h3>
          <pre style={pre}>{preview}</pre>
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Apply pass 5 — Backlog Tools Page
// Surfaces /api/backlog/* endpoints: webhook delivery, agent runs, RAG, white-label.
// =========================================================================
export function BacklogToolsPage() {
  const [tab, setTab] = useState('agents');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState(null);

  const [goal, setGoal] = useState('Reduce invoice approval time from 5 days to 2 days');
  const [iters, setIters] = useState(1);

  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docs, setDocs] = useState([]);
  const [question, setQuestion] = useState('');

  const [whSlug, setWhSlug] = useState('acme-co');
  const [whBrand, setWhBrand] = useState('Acme Co');
  const [whColor, setWhColor] = useState('#6366f1');
  const [tenants, setTenants] = useState([]);

  const [webhookId, setWebhookId] = useState('');
  const [event, setEvent] = useState('workflow.completed');
  const [payloadStr, setPayloadStr] = useState('{"hello":"world"}');
  const [deliveries, setDeliveries] = useState([]);

  async function runAgents() {
    setBusy(true); setErr(null); setOut(null);
    try {
      const r = await api.post('/backlog/agents/run', { goal, max_iterations: iters });
      setOut(r.data);
    } catch (e) {
      const m = e?.response?.data;
      if (m?.missing) setErr(`Set ${m.missing} on the backend.`); else setErr(e.message);
    } finally { setBusy(false); }
  }

  async function refreshDocs() {
    try { const r = await api.get('/backlog/rag/documents'); setDocs(r.data || []); } catch (e) {}
  }
  async function addDoc() {
    setBusy(true); setErr(null);
    try {
      await api.post('/backlog/rag/documents', { title: docTitle, content: docContent });
      setDocTitle(''); setDocContent('');
      refreshDocs();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  async function askRag() {
    setBusy(true); setErr(null); setOut(null);
    try {
      const r = await api.post('/backlog/rag/query', { question, k: 3 });
      setOut(r.data);
    } catch (e) {
      const m = e?.response?.data;
      if (m?.missing) setErr(`Set ${m.missing} on the backend (retrieval still works).`); else setErr(e.message);
      if (m?.retrieved) setOut(m);
    } finally { setBusy(false); }
  }

  async function refreshTenants() {
    try { const r = await api.get('/backlog/whitelabel/tenants'); setTenants(r.data || []); } catch (e) {}
  }
  async function addTenant() {
    setBusy(true); setErr(null);
    try {
      await api.post('/backlog/whitelabel/tenants', { slug: whSlug, brand_name: whBrand, primary_color: whColor });
      refreshTenants();
    } catch (e) { setErr(e?.response?.data?.error || e.message); } finally { setBusy(false); }
  }

  async function refreshDeliveries() {
    try { const r = await api.get('/backlog/deliveries'); setDeliveries(r.data || []); } catch (e) {}
  }
  async function sendDelivery() {
    setBusy(true); setErr(null); setOut(null);
    try {
      let parsed = {};
      try { parsed = JSON.parse(payloadStr); } catch (e) { throw new Error('payload is not valid JSON'); }
      const r = await api.post('/backlog/deliveries/send', { webhook_id: parseInt(webhookId), event, payload: parsed });
      setOut(r.data);
      refreshDeliveries();
    } catch (e) { setErr(e?.response?.data?.error || e.message); } finally { setBusy(false); }
  }

  useEffect(() => {
    if (tab === 'rag') refreshDocs();
    if (tab === 'whitelabel') refreshTenants();
    if (tab === 'deliveries') refreshDeliveries();
  }, [tab]);

  const tabBtn = (k, label) => (
    <button key={k} onClick={() => { setTab(k); setOut(null); setErr(null); }}
      style={{ ...btn, marginRight: 8, opacity: tab === k ? 1 : 0.55 }}>{label}</button>
  );

  return (
    <div style={{ padding: 24 }}>
      <h1 style={h1}>Backlog Tools</h1>
      <p style={subText}>Apply pass 5 — multi-agent orchestration, RAG, white-label tenants, signed webhook delivery.</p>
      <div style={{ marginBottom: 16 }}>
        {tabBtn('agents', 'Multi-Agent')}
        {tabBtn('rag', 'RAG Playbooks')}
        {tabBtn('whitelabel', 'White-Label')}
        {tabBtn('deliveries', 'Webhook Delivery')}
      </div>

      {tab === 'agents' && (
        <div style={card}>
          <label style={{ color: '#cbd5e1' }}>Goal</label>
          <textarea value={goal} onChange={e => setGoal(e.target.value)} rows={3} style={input}/>
          <label style={{ color: '#cbd5e1' }}>Iterations (1-3)</label>
          <input type="number" min={1} max={3} value={iters} onChange={e => setIters(parseInt(e.target.value) || 1)} style={input}/>
          <button onClick={runAgents} disabled={busy} style={btn}>{busy ? 'Running...' : 'Run Pipeline'}</button>
        </div>
      )}

      {tab === 'rag' && (
        <>
          <div style={card}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Add document</h3>
            <input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="title" style={input}/>
            <textarea value={docContent} onChange={e => setDocContent(e.target.value)} rows={5} placeholder="playbook content" style={input}/>
            <button onClick={addDoc} disabled={busy || !docContent} style={btn}>Add</button>
          </div>
          <div style={card}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Ask</h3>
            <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="question" style={input}/>
            <button onClick={askRag} disabled={busy || !question} style={btn}>Query</button>
          </div>
          <div style={card}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Documents ({docs.length})</h3>
            <pre style={pre}>{JSON.stringify(docs, null, 2)}</pre>
          </div>
        </>
      )}

      {tab === 'whitelabel' && (
        <>
          <div style={card}>
            <input value={whSlug} onChange={e => setWhSlug(e.target.value)} placeholder="slug (lowercase-dashes)" style={input}/>
            <input value={whBrand} onChange={e => setWhBrand(e.target.value)} placeholder="brand name" style={input}/>
            <input value={whColor} onChange={e => setWhColor(e.target.value)} placeholder="#hex" style={input}/>
            <button onClick={addTenant} disabled={busy} style={btn}>Save tenant</button>
          </div>
          <div style={card}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Tenants ({tenants.length})</h3>
            <pre style={pre}>{JSON.stringify(tenants, null, 2)}</pre>
          </div>
        </>
      )}

      {tab === 'deliveries' && (
        <>
          <div style={card}>
            <input value={webhookId} onChange={e => setWebhookId(e.target.value)} placeholder="webhook id (numeric)" style={input}/>
            <input value={event} onChange={e => setEvent(e.target.value)} placeholder="event (e.g. workflow.completed)" style={input}/>
            <textarea value={payloadStr} onChange={e => setPayloadStr(e.target.value)} rows={4} style={input}/>
            <button onClick={sendDelivery} disabled={busy || !webhookId} style={btn}>Send</button>
          </div>
          <div style={card}>
            <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Recent deliveries</h3>
            <pre style={pre}>{JSON.stringify(deliveries, null, 2)}</pre>
          </div>
        </>
      )}

      {err && <div style={{ ...card, borderColor: '#ef4444', color: '#fca5a5' }}>Error: {err}</div>}
      {out && (
        <div style={card}>
          <h3 style={{ color: '#e2e8f0', marginTop: 0 }}>Result</h3>
          <pre style={pre}>{JSON.stringify(out, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
