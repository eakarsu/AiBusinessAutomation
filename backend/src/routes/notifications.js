const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const emailService = require('../services/emailService');
const router = express.Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

/**
 * POST /api/notifications/send
 * Internal endpoint to send email notifications.
 * Supports three notification types:
 *   - workflow_completed
 *   - approval_needed
 *   - process_anomaly
 * Or a generic email via type "custom".
 */
router.post('/send',
  authMiddleware,
  [
    body('type')
      .notEmpty().withMessage('type is required')
      .isIn(['workflow_completed', 'approval_needed', 'process_anomaly', 'custom'])
      .withMessage('type must be one of: workflow_completed, approval_needed, process_anomaly, custom'),
    body('to')
      .notEmpty().withMessage('to (recipient email) is required')
      .isEmail().withMessage('to must be a valid email address')
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { type, to, payload } = req.body;
      let info;

      switch (type) {
        case 'workflow_completed':
          info = await emailService.notifyWorkflowCompleted({
            to,
            workflowName: payload?.workflowName || 'Unnamed Workflow',
            workflowId: payload?.workflowId,
            completedAt: payload?.completedAt
          });
          break;

        case 'approval_needed':
          info = await emailService.notifyApprovalNeeded({
            to,
            approverName: payload?.approverName,
            requestType: payload?.requestType || 'General Request',
            requestId: payload?.requestId,
            requestedBy: payload?.requestedBy,
            amount: payload?.amount
          });
          break;

        case 'process_anomaly':
          info = await emailService.notifyProcessAnomaly({
            to,
            processName: payload?.processName || 'Unknown Process',
            processId: payload?.processId,
            anomalyDescription: payload?.anomalyDescription,
            severity: payload?.severity || 'medium'
          });
          break;

        case 'custom':
          if (!payload?.subject) {
            return res.status(400).json({ error: 'payload.subject is required for custom notifications' });
          }
          info = await emailService.send({
            to,
            subject: payload.subject,
            html: payload.html,
            text: payload.text
          });
          break;

        default:
          return res.status(400).json({ error: 'Invalid notification type' });
      }

      res.json({
        success: true,
        message: `Notification of type "${type}" sent to ${to}`,
        message_id: info?.messageId
      });
    } catch (err) {
      console.error('Notification send error:', err.message);
      res.status(500).json({ error: 'Failed to send notification: ' + err.message });
    }
  }
);

module.exports = router;
