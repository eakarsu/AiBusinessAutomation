'use strict';
const path=require('path');require('dotenv').config({path:path.resolve(__dirname,'../../.env')});const express=require('express');const cors=require('cors');const pool=require('./config/database');const auth=require('./middleware/auth');const app=express();const PORT=Number(process.env.BACKEND_PORT||5001);const origins=(process.env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);if(!origins.length)throw new Error('ALLOWED_ORIGINS is required');if(!process.env.AUTOMATION_WEBHOOK_SECRET||process.env.AUTOMATION_WEBHOOK_SECRET.length<32)throw new Error('AUTOMATION_WEBHOOK_SECRET must be at least 32 characters');app.use(cors({origin:origins,credentials:true}));app.use(express.json({limit:'2mb',verify:(req,_res,buffer)=>{req.rawBody=buffer;}}));app.get('/api/health',async(_req,res)=>{try{await pool.query('SELECT 1');res.json({status:'ok'});}catch{res.status(503).json({status:'unready'});}});app.use('/api/auth',require('./routes/auth'));app.use('/api/authoritative/automation',auth,require('./routes/authoritative'));
// Advisory AI reports only; native execution and approval routes stay unchanged.
const aiWorkspaceSupport = require("../aiWorkspaceAdapters.cjs");
const aiWorkspaceDatabase = require("./config/database.js");
app.use('/api/report-workspace', require("../aiWorkspace.cjs").createAIWorkspaceRouter({
  pool: aiWorkspaceDatabase, authenticateToken: require("./middleware/auth.js"),
  aiRateLimiter: aiWorkspaceSupport.createWorkspaceLimiter(), features: require("../aiWorkspaceFeatures.json"),
}));
// These are the native UI's existing record and AI routes. Keep the
// authoritative automation API mounted above them for its separate contract.
for (const resource of [
  'workflows', 'documents', 'approvals', 'tasks', 'emails', 'invoices',
  'contracts', 'tickets', 'onboarding', 'expenses', 'meetings', 'reports',
  'compliance', 'vendors',
]) app.use(`/api/${resource}`, auth, require(`./routes/${resource}`));
for (const [path, file] of Object.entries({
  'data-entry': 'dataEntry', 'process-mining': 'processMiner',
  'workflow-optimizer': 'workflowOptimizer', 'rpa-scripts': 'rpaScripts',
  'exception-handler': 'exceptionHandler', 'roi-calculator': 'roiCalculator',
})) app.use(`/api/${path}`, auth, require(`./routes/${file}`));
app.use('/api/ai', auth, require('./routes/ai'));
app.use('/api/ai', auth, require('./routes/aiStream'));
app.use('/api/proposed', auth, require('./routes/proposedFeatures'));
app.use('/api/analytics/processes', auth, require('./routes/analyticsProcesses'));
app.use('/api/notifications', auth, require('./routes/notifications'));
app.use('/api/webhooks', auth, require('./routes/webhooks'));
app.use('/api/backlog', auth, require('./routes/backlogPass5'));
app.use('/api/custom-views', auth, require('./routes/customViews'));
app.use('/api',auth,(_req,res)=>res.status(410).json({error:'legacy_route_quarantined',replacement:'/api/authoritative/automation'}));app.use((err,_req,res,_next)=>{console.error(err.message);const status=/scope_denied/.test(err.message)?403:/missing_|required|invalid_|unsupported|mismatch|duplicate|not_applicable/.test(err.message)?422:500;res.status(status).json({error:status===500?'internal_error':err.message});});async function start(){if(!(await pool.query("SELECT to_regclass('automation_runs') AS table_name")).rows[0].table_name)throw new Error('Database migration missing; run npm run migrate');app.listen(PORT,()=>console.log(`automation workflow API listening on ${PORT}`));}if(require.main===module)start().catch(e=>{console.error(e.message);process.exit(1);});module.exports={app,start};
