const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Nodemailer transporter.
 * Configure SMTP via environment variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 * Falls back to Ethereal (test) transport when SMTP_HOST is not set.
 */
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: parseInt(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Fall back to Ethereal test account (messages captured, not sent)
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    console.log('Email: using Ethereal test account:', testAccount.user);
  }

  return transporter;
}

const FROM_ADDRESS = process.env.SMTP_FROM || '"AI Business Automation" <noreply@aibusinessautomation.local>';

const emailService = {
  /**
   * Send a generic email.
   * @param {object} opts - { to, subject, html, text }
   */
  async send({ to, subject, html, text }) {
    try {
      const t = await getTransporter();
      const info = await t.sendMail({
        from: FROM_ADDRESS,
        to,
        subject,
        text: text || '',
        html: html || ''
      });
      console.log(`Email sent to ${to}: ${info.messageId}`);
      // For Ethereal: log preview URL
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('Preview URL:', previewUrl);
      return info;
    } catch (err) {
      console.error('Email send error:', err.message);
      throw err;
    }
  },

  /**
   * Notify that a workflow has completed.
   * @param {object} opts - { to, workflowName, workflowId, completedAt }
   */
  async notifyWorkflowCompleted({ to, workflowName, workflowId, completedAt }) {
    const subject = `Workflow Completed: ${workflowName}`;
    const html = `
      <h2>Workflow Completed</h2>
      <p>Your workflow <strong>${workflowName}</strong> (ID: ${workflowId}) has completed successfully.</p>
      <p><strong>Completed at:</strong> ${completedAt || new Date().toLocaleString()}</p>
      <hr/>
      <p style="color:#666;font-size:12px;">AI Business Automation Platform</p>
    `;
    return this.send({ to, subject, html });
  },

  /**
   * Notify that an approval is needed.
   * @param {object} opts - { to, approverName, requestType, requestId, requestedBy, amount }
   */
  async notifyApprovalNeeded({ to, approverName, requestType, requestId, requestedBy, amount }) {
    const subject = `Action Required: Approval Needed — ${requestType}`;
    const html = `
      <h2>Approval Required</h2>
      <p>Hello ${approverName || 'Approver'},</p>
      <p>A new approval request requires your action:</p>
      <ul>
        <li><strong>Request Type:</strong> ${requestType}</li>
        <li><strong>Request ID:</strong> ${requestId}</li>
        <li><strong>Requested By:</strong> ${requestedBy || 'Unknown'}</li>
        ${amount ? `<li><strong>Amount:</strong> $${Number(amount).toLocaleString()}</li>` : ''}
      </ul>
      <p>Please log in to the AI Business Automation Platform to review and approve or reject this request.</p>
      <hr/>
      <p style="color:#666;font-size:12px;">AI Business Automation Platform</p>
    `;
    return this.send({ to, subject, html });
  },

  /**
   * Notify that a process anomaly was detected.
   * @param {object} opts - { to, processName, processId, anomalyDescription, severity }
   */
  async notifyProcessAnomaly({ to, processName, processId, anomalyDescription, severity }) {
    const severityColor = severity === 'high' ? '#d32f2f' : severity === 'medium' ? '#f57c00' : '#388e3c';
    const subject = `[${(severity || 'medium').toUpperCase()}] Process Anomaly Detected: ${processName}`;
    const html = `
      <h2 style="color:${severityColor};">Process Anomaly Detected</h2>
      <p>An anomaly has been detected in process <strong>${processName}</strong> (ID: ${processId}).</p>
      <p><strong>Severity:</strong> <span style="color:${severityColor};">${severity || 'medium'}</span></p>
      <h3>Anomaly Details</h3>
      <p>${anomalyDescription || 'No additional details provided.'}</p>
      <p>Please review the process immediately in the AI Business Automation Platform.</p>
      <hr/>
      <p style="color:#666;font-size:12px;">AI Business Automation Platform</p>
    `;
    return this.send({ to, subject, html });
  }
};

module.exports = emailService;
