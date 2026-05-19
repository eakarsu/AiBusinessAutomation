const express = require('express');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

/**
 * GET /api/documents/:id/workflow-status
 * Returns the current stage, approvers, time in each stage,
 * and expected completion date for a document going through approval workflows.
 */
router.get('/:id/workflow-status', authMiddleware, async (req, res) => {
  try {
    const docId = req.params.id;

    // Fetch document
    const docResult = await pool.query('SELECT * FROM documents WHERE id = $1', [docId]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const doc = docResult.rows[0];

    // Fetch related approvals for this document
    let approvals = [];
    try {
      const approvalResult = await pool.query(
        `SELECT a.*, u.name AS approver_name, u.email AS approver_email
         FROM approvals a
         LEFT JOIN users u ON u.id = a.approver_id
         WHERE a.document_id = $1
         ORDER BY a.created_at ASC`,
        [docId]
      );
      approvals = approvalResult.rows;
    } catch (e) {
      // approvals table may not have document_id — try by reference
      try {
        const approvalResult2 = await pool.query(
          `SELECT * FROM approvals WHERE reference_id = $1 OR title ILIKE $2 ORDER BY created_at ASC`,
          [docId, `%${doc.title || ''}%`]
        );
        approvals = approvalResult2.rows;
      } catch (e2) {
        approvals = [];
      }
    }

    // Build stage timeline
    const stages = approvals.map((a, idx) => {
      const enteredAt = a.created_at ? new Date(a.created_at) : null;
      const exitedAt = a.approved_at || a.rejected_at || a.updated_at;
      const exitDate = exitedAt ? new Date(exitedAt) : null;
      const timeInStageMs = enteredAt && exitDate ? exitDate - enteredAt : null;
      const timeInStageHrs = timeInStageMs !== null ? Math.round(timeInStageMs / 36000) / 100 : null;

      return {
        stage_number: idx + 1,
        approver_name: a.approver_name || a.approver || 'Unknown',
        approver_email: a.approver_email || null,
        status: a.status || 'pending',
        entered_at: enteredAt ? enteredAt.toISOString() : null,
        exited_at: exitDate ? exitDate.toISOString() : null,
        time_in_stage_hours: timeInStageHrs,
        comments: a.comments || a.notes || null
      };
    });

    // Determine current stage
    const pendingStage = stages.find(s => s.status === 'pending' || s.status === 'in_review');
    const currentStage = pendingStage || (stages.length > 0 ? stages[stages.length - 1] : null);

    // Estimate expected completion date
    // Use average hours per stage from completed stages
    const completedStages = stages.filter(s => s.time_in_stage_hours !== null);
    const avgHoursPerStage = completedStages.length > 0
      ? completedStages.reduce((sum, s) => sum + s.time_in_stage_hours, 0) / completedStages.length
      : 24; // Default: 24h per stage
    const remainingStages = stages.filter(s => s.status === 'pending' || s.status === 'in_review').length;
    const expectedCompletionMs = Date.now() + remainingStages * avgHoursPerStage * 3600 * 1000;
    const expectedCompletion = remainingStages > 0 ? new Date(expectedCompletionMs).toISOString() : null;

    res.json({
      document: {
        id: doc.id,
        title: doc.title,
        document_type: doc.document_type,
        status: doc.status,
        department: doc.department,
        routed_to: doc.routed_to,
        created_at: doc.created_at,
        updated_at: doc.updated_at
      },
      workflow_summary: {
        total_stages: stages.length,
        completed_stages: stages.filter(s => s.status === 'approved' || s.status === 'completed').length,
        rejected_stages: stages.filter(s => s.status === 'rejected').length,
        pending_stages: remainingStages,
        current_stage: currentStage ? currentStage.stage_number : null,
        current_approver: currentStage ? currentStage.approver_name : null,
        expected_completion_date: expectedCompletion,
        avg_hours_per_stage: Math.round(avgHoursPerStage * 100) / 100
      },
      stages,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Document workflow status error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
