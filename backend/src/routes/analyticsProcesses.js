const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/analytics/processes
 * Process analytics dashboard:
 *   - Total processes/workflows, automation rate
 *   - Average cycle time by process type
 *   - ROI calculation (time saved × hourly rate)
 *   - Exception rate by workflow
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const hourlyRate = parseFloat(req.query.hourly_rate) || 75; // Default $75/hr

    // 1. Overall totals
    const [workflowsRes, processesRes, tasksRes, approvalsRes] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = $1) AS active FROM workflows', ['active']),
      pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = $1) AS analyzed FROM process_mining', ['analyzed']),
      pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = $1) AS completed FROM tasks', ['completed']),
      pool.query('SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = $1) AS approved FROM approvals', ['approved'])
    ]);

    const totalWorkflows = parseInt(workflowsRes.rows[0].total) || 0;
    const activeWorkflows = parseInt(workflowsRes.rows[0].active) || 0;
    const totalProcesses = parseInt(processesRes.rows[0].total) || 0;
    const analyzedProcesses = parseInt(processesRes.rows[0].analyzed) || 0;
    const totalTasks = parseInt(tasksRes.rows[0].total) || 0;
    const completedTasks = parseInt(tasksRes.rows[0].completed) || 0;

    const automationRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // 2. Average cycle time by process type (from process_mining)
    let cycleTimes = [];
    try {
      const cycleResult = await pool.query(`
        SELECT
          process_type,
          COUNT(*) AS count,
          ROUND(AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600)::numeric, 2) AS avg_hours
        FROM process_mining
        WHERE status = 'analyzed' AND updated_at IS NOT NULL AND created_at IS NOT NULL
        GROUP BY process_type
        ORDER BY avg_hours DESC
      `);
      cycleTimes = cycleResult.rows.map(r => ({
        process_type: r.process_type || 'Unknown',
        count: parseInt(r.count),
        avg_cycle_hours: parseFloat(r.avg_hours) || 0
      }));
    } catch (e) {
      cycleTimes = [];
    }

    // 3. ROI: RPA scripts — use time_savings_hours if column exists, else estimate
    let roiData = { total_time_saved_hours: 0, estimated_value_usd: 0, rpa_scripts_count: 0 };
    try {
      const rpaRes = await pool.query(`
        SELECT COUNT(*) AS count, COALESCE(SUM(time_savings_hours), 0) AS total_hours
        FROM rpa_scripts
        WHERE status = 'generated'
      `);
      const timeSaved = parseFloat(rpaRes.rows[0].total_hours) || 0;
      roiData = {
        rpa_scripts_count: parseInt(rpaRes.rows[0].count) || 0,
        total_time_saved_hours: timeSaved,
        hourly_rate_used: hourlyRate,
        estimated_value_usd: Math.round(timeSaved * hourlyRate)
      };
    } catch (e) {
      // Column may not exist — skip
    }

    // 4. Exception rate by workflow
    let exceptionRates = [];
    try {
      const excResult = await pool.query(`
        SELECT
          w.name AS workflow_name,
          w.id AS workflow_id,
          COUNT(e.id) AS exception_count,
          ROUND(COUNT(e.id)::numeric / GREATEST(COUNT(t.id), 1) * 100, 2) AS exception_rate_pct
        FROM workflows w
        LEFT JOIN exception_logs e ON e.workflow_id = w.id
        LEFT JOIN tasks t ON t.workflow_id = w.id
        GROUP BY w.id, w.name
        ORDER BY exception_rate_pct DESC
        LIMIT 10
      `);
      exceptionRates = excResult.rows.map(r => ({
        workflow_id: r.workflow_id,
        workflow_name: r.workflow_name,
        exception_count: parseInt(r.exception_count) || 0,
        exception_rate_pct: parseFloat(r.exception_rate_pct) || 0
      }));
    } catch (e) {
      // Tables may not have exception_logs — skip
      exceptionRates = [];
    }

    res.json({
      summary: {
        total_workflows: totalWorkflows,
        active_workflows: activeWorkflows,
        total_processes_analyzed: analyzedProcesses,
        total_processes: totalProcesses,
        total_tasks: totalTasks,
        completed_tasks: completedTasks,
        automation_rate_pct: automationRate,
        total_approvals: parseInt(approvalsRes.rows[0].total) || 0,
        approved_approvals: parseInt(approvalsRes.rows[0].approved) || 0
      },
      cycle_times_by_process_type: cycleTimes,
      roi: roiData,
      exception_rates_by_workflow: exceptionRates,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
