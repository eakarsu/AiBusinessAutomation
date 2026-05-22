const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    summary: { exceptions: 38, cost_leakage: 27400, recoverable_hours: 126, top_processes: 4 },
    exceptions: [
      { process: 'invoice intake', cause: 'missing PO', monthly_cost: 9800, owner: 'Finance Ops', action: 'supplier portal rule' },
      { process: 'contract review', cause: 'nonstandard clause', monthly_cost: 7600, owner: 'Legal Ops', action: 'clause playbook' },
      { process: 'ticket escalation', cause: 'wrong queue', monthly_cost: 4100, owner: 'Support Ops', action: 'triage classifier' },
    ],
  });
});

router.post('/attribute', (req, res) => {
  const { minutes = 0, hourlyRate = 75 } = req.body || {};
  res.json({ cost: Math.round((minutes / 60) * hourlyRate), recommendation: minutes > 120 ? 'automate root cause workflow' : 'monitor trend' });
});

module.exports = router;
