const express = require('express');
const { query: queryValidator, body, validationResult } = require('express-validator');
const authMiddleware = require('../middleware/auth');
const pool = require('../config/database');
const aiService = require('../services/openrouter');
const router = express.Router();

function validate(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
}

/**
 * GET /api/ai/analyze-process/stream?processId=X
 * Streams the comprehensive process mining analysis as SSE.
 * Each step sends an event as the analysis progresses.
 */
router.get('/analyze-process/stream',
  authMiddleware,
  [
    queryValidator('processId').notEmpty().withMessage('processId query parameter is required')
  ],
  async (req, res) => {
    if (validate(req, res)) return;

    const processId = req.query.processId;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      // Step 1: Load process data
      send('status', { step: 1, total: 6, message: 'Loading process data...' });

      const processResult = await pool.query('SELECT * FROM process_mining WHERE id = $1', [processId]);
      if (processResult.rows.length === 0) {
        send('error', { message: 'Process not found' });
        return res.end();
      }
      const process = processResult.rows[0];

      send('status', {
        step: 2,
        total: 6,
        message: `Process loaded: "${process.name}" (${process.process_type || 'unknown type'})`
      });

      // Step 2: Load related workflows
      send('status', { step: 3, total: 6, message: 'Fetching related workflows and tasks...' });

      let relatedWorkflows = [];
      let relatedTasks = [];
      try {
        const wfRes = await pool.query(
          'SELECT * FROM workflows WHERE department = $1 LIMIT 5',
          [process.department]
        );
        relatedWorkflows = wfRes.rows;

        const taskRes = await pool.query(
          'SELECT * FROM tasks WHERE department = $1 LIMIT 20',
          [process.department]
        );
        relatedTasks = taskRes.rows;
      } catch (e) {
        // Not critical — continue without related data
      }

      send('data', {
        step: 3,
        related_workflows: relatedWorkflows.length,
        related_tasks: relatedTasks.length
      });

      // Step 3: Compute preliminary metrics
      send('status', { step: 4, total: 6, message: 'Computing preliminary performance metrics...' });

      const completedTasks = relatedTasks.filter(t => t.status === 'completed');
      const taskCompletionRate = relatedTasks.length > 0
        ? Math.round((completedTasks.length / relatedTasks.length) * 100)
        : 0;

      send('data', {
        step: 4,
        task_completion_rate_pct: taskCompletionRate,
        completed_tasks: completedTasks.length,
        total_tasks: relatedTasks.length
      });

      // Step 4: Run AI analysis
      send('status', { step: 5, total: 6, message: 'Running AI process mining analysis (this may take a moment)...' });

      const analysis = await aiService.analyzeProcess(
        process.name,
        process.description,
        process.event_log
      );

      // Step 5: Save results
      send('status', { step: 6, total: 6, message: 'Saving analysis results to database...' });

      await pool.query(
        'UPDATE process_mining SET ai_analysis = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [analysis, 'analyzed', processId]
      );

      // Send final result
      send('result', {
        process_id: processId,
        process_name: process.name,
        ai_analysis: analysis,
        task_completion_rate_pct: taskCompletionRate,
        related_workflows_count: relatedWorkflows.length
      });

      send('done', { message: 'Analysis complete', process_id: processId });
    } catch (err) {
      console.error('SSE stream error:', err);
      send('error', { message: err.message });
    } finally {
      res.end();
    }
  }
);

/**
 * POST /api/ai/generate-rpa
 * Generate an RPA script directly from task description + target application.
 * Saves to rpa_scripts table.
 */
router.post('/generate-rpa',
  authMiddleware,
  [
    body('task_description')
      .notEmpty().withMessage('task_description is required')
      .isString()
      .isLength({ max: 5000 }).withMessage('task_description must be 5000 characters or fewer')
      .trim(),
    body('target_application')
      .notEmpty().withMessage('target_application is required')
      .isString()
      .trim()
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { task_description, target_application, name } = req.body;

      // Determine platform preference based on target app
      const isWebApp = /(browser|chrome|firefox|web|url|http)/i.test(target_application);
      const platform = isWebApp ? 'Puppeteer (JavaScript)' : 'pyautogui (Python)';

      const scriptPrompt = `Generate a production-ready RPA automation script for the following:

Task Description: ${task_description}
Target Application: ${target_application}
Preferred Platform: ${platform}

Provide:
1. Complete working script (${isWebApp ? 'JavaScript with Puppeteer' : 'Python with pyautogui'})
2. Step-by-step explanation of each automation step
3. Prerequisites and installation instructions
4. Error handling and retry logic
5. Configuration variables to customize

The script should be complete, runnable, and include comments.`;

      const generatedScript = await aiService.generateCompletion(
        scriptPrompt,
        `You are an expert RPA developer. Generate complete, working automation scripts using ${platform}. Include proper error handling, logging, and comments.`
      );

      // Save to rpa_scripts table
      const scriptName = name || `Auto: ${task_description.substring(0, 50)}`;
      const result = await pool.query(
        `INSERT INTO rpa_scripts (name, task_description, platform, generated_script, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [scriptName, task_description, platform, generatedScript, 'generated', req.user.id]
      );

      res.status(201).json({
        script: result.rows[0],
        generated_script: generatedScript,
        platform
      });
    } catch (err) {
      console.error('RPA generation error:', err);
      res.status(500).json({ error: 'RPA generation failed: ' + err.message });
    }
  }
);

/**
 * POST /api/ai/analyze-process-description
 * Validate and analyze a process description (with max 5000 char validation).
 */
router.post('/analyze-process-description',
  authMiddleware,
  [
    body('process_description')
      .notEmpty().withMessage('process_description is required')
      .isString()
      .isLength({ max: 5000 }).withMessage('process_description must be 5000 characters or fewer')
      .trim(),
    body('workflow_id')
      .optional()
      .isInt({ min: 1 }).withMessage('workflow_id must be a valid positive integer')
  ],
  async (req, res) => {
    if (validate(req, res)) return;
    try {
      const { process_description, workflow_id } = req.body;

      let workflowContext = '';
      if (workflow_id) {
        const wfResult = await pool.query('SELECT * FROM workflows WHERE id = $1', [workflow_id]);
        if (wfResult.rows.length > 0) {
          workflowContext = `\n\nRelated Workflow: ${JSON.stringify(wfResult.rows[0], null, 2)}`;
        }
      }

      const analysis = await aiService.analyzeProcess(
        'Direct Description Analysis',
        process_description,
        workflowContext
      );

      res.json({ analysis, process_description_length: process_description.length });
    } catch (err) {
      console.error('Process description analysis error:', err);
      res.status(500).json({ error: 'Analysis failed: ' + err.message });
    }
  }
);

module.exports = router;
