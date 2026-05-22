import React, { useEffect, useState } from 'react';

export default function ExceptionCostAttribution() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/exception-cost-attribution').then((res) => res.json()).then(setData).catch(() => setData(null));
  }, []);
  return (
    <div className="page">
      <h1>Exception Cost Attribution</h1>
      <p>Quantify cost leakage from workflow exceptions and assign root-cause owners.</p>
      <div className="stats-grid">
        {data && Object.entries(data.summary).map(([key, value]) => <div className="stat-card" key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{value}</strong></div>)}
      </div>
      <div className="card">
        {(data?.exceptions || []).map((item) => <div key={item.process} style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}><strong>{item.process}</strong><div>{item.cause} - ${item.monthly_cost}/mo - {item.action}</div></div>)}
      </div>
    </div>
  );
}
