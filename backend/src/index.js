const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });

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

const app = express();
const PORT = process.env.BACKEND_PORT || 5001;

// Middleware
app.use(cors());
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
app.use('/api/ai', aiRoutes);

// New Operations Routes
app.use('/api/process-mining', processMinerRoutes);
app.use('/api/workflow-optimizer', workflowOptimizerRoutes);
app.use('/api/rpa-scripts', rpaScriptsRoutes);
app.use('/api/exception-handler', exceptionHandlerRoutes);
app.use('/api/roi-calculator', roiCalculatorRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
