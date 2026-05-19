const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const workflowRoutes = require('./routes/workflows');
const documentRoutes = require('./routes/documents');
const approvalRoutes = require('./routes/approvals');
const taskRoutes = require('./routes/tasks');
const emailRoutes = require('./routes/emails');
const invoiceRoutes = require('./routes/invoices');
const contractRoutes = require('./routes/contracts');
const ticketRoutes = require('./routes/tickets');
const onboardingRoutes = require('./routes/onboarding');
const expenseRoutes = require('./routes/expenses');
const meetingRoutes = require('./routes/meetings');
const reportRoutes = require('./routes/reports');
const dataEntryRoutes = require('./routes/dataEntry');
const complianceRoutes = require('./routes/compliance');
const vendorRoutes = require('./routes/vendors');
const aiRoutes = require('./routes/ai');

// New Operations Features
const processMinerRoutes = require('./routes/processMiner');
const workflowOptimizerRoutes = require('./routes/workflowOptimizer');
const rpaScriptsRoutes = require('./routes/rpaScripts');
const exceptionHandlerRoutes = require('./routes/exceptionHandler');
const roiCalculatorRoutes = require('./routes/roiCalculator');

// New production improvement features
const notificationRoutes = require('./routes/notifications');
const analyticsProcessesRoutes = require('./routes/analyticsProcesses');
const documentWorkflowRoutes = require('./routes/documentWorkflow');
const aiStreamRoutes = require('./routes/aiStream');

// Proposed NEW features (audit-driven)
const proposedFeaturesRoutes = require('./routes/proposedFeatures');

const app = express();
const PORT = process.env.BACKEND_PORT || 5001;

// CORS — restrict to allowed origins from env (comma-separated list)
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));

// Rate limiter for all AI routes: 20 requests per 15 minutes per IP
const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests. Please wait 15 minutes before retrying.' }
});

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/data-entry', dataEntryRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/ai', aiRateLimiter, aiRoutes);

// New Operations Routes (also AI-backed — apply same rate limiter)
app.use('/api/process-mining', aiRateLimiter, processMinerRoutes);
app.use('/api/workflow-optimizer', aiRateLimiter, workflowOptimizerRoutes);
app.use('/api/rpa-scripts', aiRateLimiter, rpaScriptsRoutes);
app.use('/api/exception-handler', aiRateLimiter, exceptionHandlerRoutes);
app.use('/api/roi-calculator', aiRateLimiter, roiCalculatorRoutes);

// New Production Improvement Routes
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics/processes', analyticsProcessesRoutes);
app.use('/api/documents', documentWorkflowRoutes);   // adds /:id/workflow-status to existing document routes
app.use('/api/ai', aiRateLimiter, aiStreamRoutes);   // SSE + extra AI endpoints

// Proposed NEW features (audit-driven non-CRUD endpoints)
app.use('/api/proposed', aiRateLimiter, proposedFeaturesRoutes);

// Webhook subscriptions (integration API)
app.use('/api/webhooks', require('./routes/webhooks'));

// Apply pass 5 backlog: outbound delivery, multi-agent, RAG, white-label.
// All endpoints under /api/backlog/* — additive only, lazy schema.
app.use('/api/backlog', aiRateLimiter, require('./routes/backlogPass5'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(errorHandler);


app.use('/api/multi-agent-orch', require('./routes/multiAgentOrchestrator')); // apply pass 6 — audit custom suggestion

app.use('/api/sop-rag', require('./routes/sopRagClassifier')); // apply pass 6 — audit custom suggestion

app.use('/api/exception-stream', require('./routes/exceptionStreamDetector')); // apply pass 6 — audit custom suggestion

app.use('/api/consultant-studio', require('./routes/consultantStudio')); // apply pass 6 — audit custom suggestion

// === Custom Views (Automation Views) ===
app.use('/api/custom-views', require('./routes/customViews'));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


// === Batch 01 Gaps & Frontend Mounts ===
app.use('/api/gap-despite-ai-js-aistream-js-route-files-0-mounted-ai', require('./routes/gap_despite_ai_js_aistream_js_route_files_0_mounted_ai'));
app.use('/api/gap-no-ai-process-mining-from-logs-to-suggest-automati', require('./routes/gap_no_ai_process_mining_from_logs_to_suggest_automati'));
app.use('/api/gap-no-ai-document-extraction-invoices-pos-contracts', require('./routes/gap_no_ai_document_extraction_invoices_pos_contracts'));
app.use('/api/gap-no-ai-bot-builder-for-repetitive-tasks', require('./routes/gap_no_ai_bot_builder_for_repetitive_tasks'));
app.use('/api/gap-only-1-frontend-page-despite-29-backend-routes-sev', require('./routes/gap_only_1_frontend_page_despite_29_backend_routes_sev'));
app.use('/api/gap-no-drag-and-drop-workflow-designer', require('./routes/gap_no_drag_and_drop_workflow_designer'));
app.use('/api/gap-no-rpa-recorder-for-screen-based-steps', require('./routes/gap_no_rpa_recorder_for_screen_based_steps'));
app.use('/api/gap-no-task-queue-dashboard-for-human-in-the-loop', require('./routes/gap_no_task_queue_dashboard_for_human_in_the_loop'));
app.use('/api/gap-no-direct-enterprise-system-api-clients-salesforce', require('./routes/gap_no_direct_enterprise_system_api_clients_salesforce'));
