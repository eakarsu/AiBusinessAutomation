const express = require('express');
const authMiddleware = require('../middleware/auth');
const aiService = require('../services/openrouter');
const router = express.Router();

// General AI chat
router.post('/chat', authMiddleware, async (req, res) => {
  try {
    const { prompt, context } = req.body;
    const response = await aiService.generateCompletion(
      prompt,
      context || 'You are a helpful business automation assistant.'
    );
    res.json({ response });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Analyze document
router.post('/analyze-document', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const analysis = await aiService.analyzeDocument(content);
    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Analyze contract
router.post('/analyze-contract', authMiddleware, async (req, res) => {
  try {
    const { content } = req.body;
    const analysis = await aiService.analyzeContract(content);
    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Categorize email
router.post('/categorize-email', authMiddleware, async (req, res) => {
  try {
    const { subject, body } = req.body;
    const analysis = await aiService.categorizeEmail(subject, body);
    res.json({ analysis });
  } catch (error) {
    console.error('AI categorization error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Suggest workflow
router.post('/suggest-workflow', authMiddleware, async (req, res) => {
  try {
    const { description } = req.body;
    const suggestion = await aiService.generateWorkflowSuggestion(description);
    res.json({ suggestion });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Analyze expense
router.post('/analyze-expense', authMiddleware, async (req, res) => {
  try {
    const { description, amount, category } = req.body;
    const analysis = await aiService.analyzeExpense(description, amount, category);
    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Generate meeting agenda
router.post('/generate-agenda', authMiddleware, async (req, res) => {
  try {
    const { topic, participants, duration } = req.body;
    const agenda = await aiService.generateMeetingAgenda(topic, participants, duration);
    res.json({ agenda });
  } catch (error) {
    console.error('AI agenda error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Prioritize ticket
router.post('/prioritize-ticket', authMiddleware, async (req, res) => {
  try {
    const { title, description } = req.body;
    const analysis = await aiService.prioritizeTicket(title, description);
    res.json({ analysis });
  } catch (error) {
    console.error('AI prioritization error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Analyze compliance
router.post('/analyze-compliance', authMiddleware, async (req, res) => {
  try {
    const { requirement, currentState } = req.body;
    const analysis = await aiService.analyzeCompliance(requirement, currentState);
    res.json({ analysis });
  } catch (error) {
    console.error('AI analysis error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Evaluate vendor
router.post('/evaluate-vendor', authMiddleware, async (req, res) => {
  try {
    const { vendorName, criteria } = req.body;
    const evaluation = await aiService.evaluateVendor(vendorName, criteria);
    res.json({ evaluation });
  } catch (error) {
    console.error('AI evaluation error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Generate report
router.post('/generate-report', authMiddleware, async (req, res) => {
  try {
    const { dataDescription, reportType } = req.body;
    const report = await aiService.generateReport(dataDescription, reportType);
    res.json({ report });
  } catch (error) {
    console.error('AI report error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Suggest onboarding tasks
router.post('/suggest-onboarding', authMiddleware, async (req, res) => {
  try {
    const { role, department } = req.body;
    const suggestion = await aiService.suggestOnboardingTasks(role, department);
    res.json({ suggestion });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Extract data from text
router.post('/extract-data', authMiddleware, async (req, res) => {
  try {
    const { text, fields } = req.body;
    const extracted = await aiService.extractDataFromText(text, fields);
    res.json({ extracted });
  } catch (error) {
    console.error('AI extraction error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

// Suggest approval chain
router.post('/suggest-approval-chain', authMiddleware, async (req, res) => {
  try {
    const { requestType, amount } = req.body;
    const suggestion = await aiService.suggestApprovalChain(requestType, amount);
    res.json({ suggestion });
  } catch (error) {
    console.error('AI suggestion error:', error);
    res.status(500).json({ error: 'AI service unavailable' });
  }
});

module.exports = router;
