/**
 * CustomViewsPage — "Automation Views"
 * Aggregates the 4 custom-view components on a single route.
 */
import React from 'react';
import {
  ExecutionCountChart,
  BottleneckHeatmap,
  RunbookPdfExport,
  RulesEditor,
} from '../components/CustomViews';

const styles = {
  wrap: { padding: 24, maxWidth: 1200, margin: '0 auto' },
  header: { color: '#e2e8f0', marginBottom: 4 },
  sub: { color: '#94a3b8', marginTop: 0, marginBottom: 20 },
  grid: { display: 'grid', gridTemplateColumns: '1fr', gap: 0 },
};

export default function CustomViewsPage() {
  return (
    <div style={styles.wrap} data-testid="custom-views-page">
      <h1 style={styles.header}>Automation Views</h1>
      <p style={styles.sub}>
        Four custom perspectives on your business workflow automation: chart daily
        execution counts, surface bottlenecks on a step-by-time heatmap, export an
        operational runbook PDF, and manage workflow trigger/action rules.
      </p>
      <div style={styles.grid}>
        <ExecutionCountChart />
        <BottleneckHeatmap />
        <RunbookPdfExport />
        <RulesEditor />
      </div>
    </div>
  );
}
