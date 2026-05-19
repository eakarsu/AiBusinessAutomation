const express = require('express');
const { body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const aiService = require('../services/openrouter');
const pool = require('../config/database');
const router = express.Router();

// Helper: run express-validator checks and return 400 on failure
function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

// Helper: persist an AI result to the ai_results table
async function persistAiResult(endpoint, inputData, result, userId) {
  try {
    await pool.query(
      `INSERT INTO ai_results (endpoint, input_data, result, user_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [endpoint, JSON.stringify(inputData), result, userId || null]
    );
  } catch (err) {
    // Log but don't fail the response if persistence fails
    console.error('AI result persistence error:', err.message);
  }
}

// General AI chat
router.post(
  '/chat',
  authMiddleware,
  [
    body('prompt').notEmpty().withMessage('prompt is required').isString().trim(),
    body('context').optional().isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { prompt, context } = req.body;
      const response = await aiService.generateCompletion(
        prompt,
        context || 'You are a helpful business automation assistant.'
      );
      await persistAiResult('chat', { prompt, context }, response, req.user?.id);
      res.json({ response });
    } catch (error) {
      console.error('AI chat error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Analyze document
router.post(
  '/analyze-document',
  authMiddleware,
  [
    body('content').notEmpty().withMessage('content is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { content } = req.body;
      const analysis = await aiService.analyzeDocument(content);
      await persistAiResult('analyze-document', { content: content.slice(0, 500) }, analysis, req.user?.id);
      res.json({ analysis });
    } catch (error) {
      console.error('AI analysis error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Analyze contract
router.post(
  '/analyze-contract',
  authMiddleware,
  [
    body('content').notEmpty().withMessage('content is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { content } = req.body;
      const analysis = await aiService.analyzeContract(content);
      await persistAiResult('analyze-contract', { content: content.slice(0, 500) }, analysis, req.user?.id);
      res.json({ analysis });
    } catch (error) {
      console.error('AI analysis error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Categorize email
router.post(
  '/categorize-email',
  authMiddleware,
  [
    body('subject').notEmpty().withMessage('subject is required').isString().trim(),
    body('body').notEmpty().withMessage('body is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { subject, body: emailBody } = req.body;
      const analysis = await aiService.categorizeEmail(subject, emailBody);
      await persistAiResult('categorize-email', { subject }, analysis, req.user?.id);
      res.json({ analysis });
    } catch (error) {
      console.error('AI categorization error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Suggest workflow
router.post(
  '/suggest-workflow',
  authMiddleware,
  [
    body('description')
      .notEmpty().withMessage('description is required')
      .isString()
      .isLength({ max: 5000 }).withMessage('description must be 5000 characters or fewer')
      .trim(),
    body('workflow_id')
      .optional()
      .isInt({ min: 1 }).withMessage('workflow_id must be a valid positive integer')
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { description } = req.body;
      const suggestion = await aiService.generateWorkflowSuggestion(description);
      await persistAiResult('suggest-workflow', { description: description.slice(0, 300) }, suggestion, req.user?.id);
      res.json({ suggestion });
    } catch (error) {
      console.error('AI suggestion error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Analyze expense
router.post(
  '/analyze-expense',
  authMiddleware,
  [
    body('description').notEmpty().withMessage('description is required').isString().trim(),
    body('amount').notEmpty().withMessage('amount is required').isFloat({ min: 0 }).withMessage('amount must be a positive number'),
    body('category').notEmpty().withMessage('category is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { description, amount, category } = req.body;
      const analysis = await aiService.analyzeExpense(description, amount, category);
      await persistAiResult('analyze-expense', { description, amount, category }, analysis, req.user?.id);
      res.json({ analysis });
    } catch (error) {
      console.error('AI analysis error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Generate meeting agenda
router.post(
  '/generate-agenda',
  authMiddleware,
  [
    body('topic').notEmpty().withMessage('topic is required').isString().trim(),
    body('participants').notEmpty().withMessage('participants is required'),
    body('duration').notEmpty().withMessage('duration is required').isInt({ min: 1 }).withMessage('duration must be a positive integer (minutes)')
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { topic, participants, duration } = req.body;
      const agenda = await aiService.generateMeetingAgenda(topic, participants, duration);
      await persistAiResult('generate-agenda', { topic, duration }, agenda, req.user?.id);
      res.json({ agenda });
    } catch (error) {
      console.error('AI agenda error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Prioritize ticket
router.post(
  '/prioritize-ticket',
  authMiddleware,
  [
    body('title').notEmpty().withMessage('title is required').isString().trim(),
    body('description').notEmpty().withMessage('description is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { title, description } = req.body;
      const analysis = await aiService.prioritizeTicket(title, description);
      await persistAiResult('prioritize-ticket', { title }, analysis, req.user?.id);
      res.json({ analysis });
    } catch (error) {
      console.error('AI prioritization error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Analyze compliance
router.post(
  '/analyze-compliance',
  authMiddleware,
  [
    body('requirement').notEmpty().withMessage('requirement is required').isString().trim(),
    body('currentState').notEmpty().withMessage('currentState is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { requirement, currentState } = req.body;
      const analysis = await aiService.analyzeCompliance(requirement, currentState);
      await persistAiResult('analyze-compliance', { requirement }, analysis, req.user?.id);
      res.json({ analysis });
    } catch (error) {
      console.error('AI analysis error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Evaluate vendor
router.post(
  '/evaluate-vendor',
  authMiddleware,
  [
    body('vendorName').notEmpty().withMessage('vendorName is required').isString().trim(),
    body('criteria').notEmpty().withMessage('criteria is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { vendorName, criteria } = req.body;
      const evaluation = await aiService.evaluateVendor(vendorName, criteria);
      await persistAiResult('evaluate-vendor', { vendorName }, evaluation, req.user?.id);
      res.json({ evaluation });
    } catch (error) {
      console.error('AI evaluation error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Generate report
router.post(
  '/generate-report',
  authMiddleware,
  [
    body('dataDescription').notEmpty().withMessage('dataDescription is required').isString().trim(),
    body('reportType').notEmpty().withMessage('reportType is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { dataDescription, reportType } = req.body;
      const report = await aiService.generateReport(dataDescription, reportType);
      await persistAiResult('generate-report', { reportType }, report, req.user?.id);
      res.json({ report });
    } catch (error) {
      console.error('AI report error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Suggest onboarding tasks
router.post(
  '/suggest-onboarding',
  authMiddleware,
  [
    body('role').notEmpty().withMessage('role is required').isString().trim(),
    body('department').notEmpty().withMessage('department is required').isString().trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { role, department } = req.body;
      const suggestion = await aiService.suggestOnboardingTasks(role, department);
      await persistAiResult('suggest-onboarding', { role, department }, suggestion, req.user?.id);
      res.json({ suggestion });
    } catch (error) {
      console.error('AI suggestion error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Extract data from text
router.post(
  '/extract-data',
  authMiddleware,
  [
    body('text').notEmpty().withMessage('text is required').isString().trim(),
    body('fields').isArray({ min: 1 }).withMessage('fields must be a non-empty array')
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { text, fields } = req.body;
      const extracted = await aiService.extractDataFromText(text, fields);
      await persistAiResult('extract-data', { fields }, extracted, req.user?.id);
      res.json({ extracted });
    } catch (error) {
      console.error('AI extraction error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

// Suggest approval chain
router.post(
  '/suggest-approval-chain',
  authMiddleware,
  [
    body('requestType').notEmpty().withMessage('requestType is required').isString().trim(),
    body('amount').notEmpty().withMessage('amount is required').isFloat({ min: 0 }).withMessage('amount must be a positive number')
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { requestType, amount } = req.body;
      const suggestion = await aiService.suggestApprovalChain(requestType, amount);
      await persistAiResult('suggest-approval-chain', { requestType, amount }, suggestion, req.user?.id);
      res.json({ suggestion });
    } catch (error) {
      console.error('AI suggestion error:', error);
      res.status(500).json({ error: 'AI service unavailable' });
    }
  }
);

module.exports = router;
