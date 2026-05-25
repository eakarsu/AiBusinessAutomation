const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ai_business_automation',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function createTables() {
  const queries = `
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'user',
      reset_token VARCHAR(255),
      reset_token_expires TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Token blacklist table
    CREATE TABLE IF NOT EXISTS token_blacklist (
      id SERIAL PRIMARY KEY,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Workflows table
    CREATE TABLE IF NOT EXISTS workflows (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      trigger_type VARCHAR(100),
      steps JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'draft',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Documents table
    CREATE TABLE IF NOT EXISTS documents (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT,
      document_type VARCHAR(100),
      department VARCHAR(100),
      status VARCHAR(50) DEFAULT 'pending',
      routed_to INTEGER REFERENCES users(id),
      ai_analysis TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Approvals table
    CREATE TABLE IF NOT EXISTS approvals (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      request_type VARCHAR(100),
      amount DECIMAL(15,2),
      priority VARCHAR(50) DEFAULT 'medium',
      approval_chain JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'pending',
      requested_by INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      approval_comments TEXT,
      approved_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Automation Tasks table
    CREATE TABLE IF NOT EXISTS automation_tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      task_type VARCHAR(100),
      schedule VARCHAR(100),
      trigger_condition TEXT,
      actions JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'active',
      last_run TIMESTAMP,
      run_count INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Emails table
    CREATE TABLE IF NOT EXISTS emails (
      id SERIAL PRIMARY KEY,
      from_address VARCHAR(255) NOT NULL,
      to_address VARCHAR(255) NOT NULL,
      subject VARCHAR(500),
      body TEXT,
      category VARCHAR(100) DEFAULT 'general',
      priority VARCHAR(50) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'unread',
      assigned_to INTEGER REFERENCES users(id),
      ai_analysis TEXT,
      received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Invoices table
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(100) NOT NULL,
      vendor_name VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      due_date DATE,
      description TEXT,
      category VARCHAR(100),
      status VARCHAR(50) DEFAULT 'pending',
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP,
      ai_analysis TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Contracts table
    CREATE TABLE IF NOT EXISTS contracts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      party_name VARCHAR(255) NOT NULL,
      contract_type VARCHAR(100),
      value DECIMAL(15,2),
      start_date DATE,
      end_date DATE,
      terms TEXT,
      status VARCHAR(50) DEFAULT 'draft',
      ai_analysis TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Tickets table
    CREATE TABLE IF NOT EXISTS tickets (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      priority VARCHAR(50) DEFAULT 'medium',
      customer_name VARCHAR(255),
      customer_email VARCHAR(255),
      status VARCHAR(50) DEFAULT 'open',
      assigned_to INTEGER REFERENCES users(id),
      resolution TEXT,
      ai_analysis TEXT,
      closed_at TIMESTAMP,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Onboarding table
    CREATE TABLE IF NOT EXISTS onboarding (
      id SERIAL PRIMARY KEY,
      employee_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      role VARCHAR(100),
      department VARCHAR(100),
      start_date DATE,
      manager VARCHAR(255),
      tasks JSONB DEFAULT '[]',
      progress INTEGER DEFAULT 0,
      status VARCHAR(50) DEFAULT 'pending',
      ai_suggestions TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Expenses table
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      category VARCHAR(100),
      description TEXT,
      receipt_url VARCHAR(500),
      expense_date DATE,
      status VARCHAR(50) DEFAULT 'pending',
      submitted_by INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      approved_at TIMESTAMP,
      ai_analysis TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Meetings table
    CREATE TABLE IF NOT EXISTS meetings (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      meeting_date TIMESTAMP,
      duration INTEGER,
      participants JSONB DEFAULT '[]',
      location VARCHAR(255),
      meeting_type VARCHAR(100),
      status VARCHAR(50) DEFAULT 'scheduled',
      agenda TEXT,
      notes TEXT,
      organizer INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Reports table
    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      report_type VARCHAR(100),
      description TEXT,
      data_source VARCHAR(255),
      parameters JSONB DEFAULT '{}',
      schedule VARCHAR(100),
      content TEXT,
      status VARCHAR(50) DEFAULT 'draft',
      last_generated TIMESTAMP,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Data Entries table
    CREATE TABLE IF NOT EXISTS data_entries (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      source_type VARCHAR(100),
      raw_data TEXT,
      extracted_data JSONB DEFAULT '{}',
      fields_schema JSONB DEFAULT '[]',
      status VARCHAR(50) DEFAULT 'pending',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Compliance table
    CREATE TABLE IF NOT EXISTS compliance (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      regulation_type VARCHAR(100),
      requirement TEXT,
      current_status TEXT,
      due_date DATE,
      responsible_party VARCHAR(255),
      evidence TEXT,
      status VARCHAR(50) DEFAULT 'pending',
      ai_analysis TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Vendors table
    CREATE TABLE IF NOT EXISTS vendors (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      contact_name VARCHAR(255),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      address TEXT,
      contract_value DECIMAL(15,2),
      contract_start DATE,
      contract_end DATE,
      rating INTEGER,
      status VARCHAR(50) DEFAULT 'active',
      ai_evaluation TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ============================================
    -- NEW OPERATIONS TABLES
    -- ============================================

    -- Process Mining table
    CREATE TABLE IF NOT EXISTS process_mining (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      process_type VARCHAR(100),
      event_log TEXT,
      department VARCHAR(100),
      complexity VARCHAR(50) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'pending',
      ai_analysis TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Workflow Optimizations table
    CREATE TABLE IF NOT EXISTS workflow_optimizations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      workflow_description TEXT,
      current_steps TEXT,
      bottlenecks TEXT,
      goals TEXT,
      priority VARCHAR(50) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'pending',
      ai_recommendations TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- RPA Scripts table
    CREATE TABLE IF NOT EXISTS rpa_scripts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      task_description TEXT,
      platform VARCHAR(100),
      input_data TEXT,
      output_format TEXT,
      complexity VARCHAR(50) DEFAULT 'medium',
      status VARCHAR(50) DEFAULT 'pending',
      generated_script TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Automation Exceptions table
    CREATE TABLE IF NOT EXISTS automation_exceptions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      exception_type VARCHAR(100),
      error_message TEXT,
      source_system VARCHAR(255),
      stack_trace TEXT,
      severity VARCHAR(50) DEFAULT 'medium',
      impact TEXT,
      status VARCHAR(50) DEFAULT 'open',
      ai_resolution TEXT,
      resolved_at TIMESTAMP,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- ROI Calculations table
    CREATE TABLE IF NOT EXISTS roi_calculations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      project_description TEXT,
      implementation_cost DECIMAL(15,2),
      annual_savings DECIMAL(15,2),
      time_savings_hours INTEGER,
      current_fte_cost DECIMAL(15,2),
      automation_type VARCHAR(100),
      payback_period VARCHAR(100),
      status VARCHAR(50) DEFAULT 'draft',
      ai_analysis TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- AI Results persistence table (stores all /api/ai/* endpoint responses)
    CREATE TABLE IF NOT EXISTS ai_results (
      id SERIAL PRIMARY KEY,
      endpoint VARCHAR(100) NOT NULL,
      input_data JSONB,
      result TEXT NOT NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await pool.query(queries);

  // Add columns if they don't exist (for existing databases)
  await pool.query(`
    DO $$ BEGIN
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    EXCEPTION WHEN others THEN NULL;
    END $$;
  `);

  console.log('Tables created successfully');
}

async function seedData() {
  // Hash password
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // Seed users (15 users)
  const userResult = await pool.query(`
    INSERT INTO users (email, password, name, role) VALUES
    ($1, $2, 'Admin User', 'admin'),
    ('manager@company.com', $2, 'Manager User', 'manager'),
    ('user@company.com', $2, 'Regular User', 'user'),
    ('sarah.johnson@company.com', $2, 'Sarah Johnson', 'manager'),
    ('mike.wilson@company.com', $2, 'Mike Wilson', 'user'),
    ('emily.brown@company.com', $2, 'Emily Brown', 'user'),
    ('david.lee@company.com', $2, 'David Lee', 'user'),
    ('lisa.chen@company.com', $2, 'Lisa Chen', 'manager'),
    ('tom.garcia@company.com', $2, 'Tom Garcia', 'user'),
    ('anna.martinez@company.com', $2, 'Anna Martinez', 'user'),
    ('robert.taylor@company.com', $2, 'Robert Taylor', 'user'),
    ('jennifer.white@company.com', $2, 'Jennifer White', 'manager'),
    ('chris.anderson@company.com', $2, 'Chris Anderson', 'user'),
    ('michelle.thomas@company.com', $2, 'Michelle Thomas', 'user'),
    ('kevin.jackson@company.com', $2, 'Kevin Jackson', 'user')
    ON CONFLICT (email) DO NOTHING
    RETURNING id
  `, [process.env.DEFAULT_ADMIN_EMAIL || 'admin@company.com', hashedPassword]);

  const userId = userResult.rows[0]?.id || 1;

  // Seed Workflows (15 items)
  await pool.query(`
    INSERT INTO workflows (name, description, trigger_type, steps, status, created_by) VALUES
    ('Invoice Approval', 'Automated invoice approval workflow', 'document_upload', '["Review", "Approve", "Process Payment"]', 'active', $1),
    ('Employee Onboarding', 'New employee setup process', 'manual', '["IT Setup", "HR Forms", "Training"]', 'active', $1),
    ('Contract Review', 'Legal contract review workflow', 'email', '["Legal Review", "Manager Approval", "Sign"]', 'active', $1),
    ('Expense Reimbursement', 'Employee expense processing', 'form_submission', '["Submit", "Manager Review", "Finance Approval"]', 'active', $1),
    ('Purchase Order', 'Purchase request workflow', 'manual', '["Request", "Budget Check", "Approve", "Order"]', 'active', $1),
    ('Leave Request', 'Employee leave approval', 'form_submission', '["Submit", "Manager Approval", "HR Record"]', 'active', $1),
    ('Support Ticket Escalation', 'Auto-escalate critical tickets', 'condition', '["Triage", "Assign", "Escalate if needed"]', 'active', $1),
    ('Document Routing', 'Route documents to departments', 'document_upload', '["Classify", "Route", "Acknowledge"]', 'active', $1),
    ('Vendor Onboarding', 'New vendor setup process', 'manual', '["Documentation", "Compliance Check", "Activate"]', 'draft', $1),
    ('Budget Approval', 'Department budget requests', 'form_submission', '["Submit", "Finance Review", "Executive Approval"]', 'active', $1),
    ('IT Service Request', 'IT support ticket workflow', 'form_submission', '["Log", "Assign", "Resolve", "Close"]', 'active', $1),
    ('Performance Review', 'Annual performance review process', 'scheduled', '["Self Review", "Manager Review", "HR Review"]', 'draft', $1),
    ('Customer Feedback', 'Process customer feedback', 'email', '["Receive", "Categorize", "Respond", "Track"]', 'active', $1),
    ('Compliance Audit', 'Quarterly compliance check', 'scheduled', '["Collect Evidence", "Review", "Report"]', 'active', $1),
    ('Project Approval', 'New project initiation', 'manual', '["Proposal", "Review", "Approval", "Kickoff"]', 'active', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Documents (15 items)
  await pool.query(`
    INSERT INTO documents (title, content, document_type, department, status, created_by) VALUES
    ('Q4 Financial Report', 'Quarterly financial performance summary...', 'report', 'Finance', 'approved', $1),
    ('Employee Handbook 2024', 'Company policies and procedures...', 'policy', 'HR', 'approved', $1),
    ('Vendor Contract - TechCorp', 'Service agreement with TechCorp...', 'contract', 'Legal', 'pending', $1),
    ('Marketing Strategy 2024', 'Annual marketing plan and budget...', 'plan', 'Marketing', 'approved', $1),
    ('IT Security Policy', 'Information security guidelines...', 'policy', 'IT', 'approved', $1),
    ('Sales Forecast Q1', 'Projected sales for next quarter...', 'report', 'Sales', 'draft', $1),
    ('Office Lease Agreement', 'Commercial lease for main office...', 'contract', 'Operations', 'approved', $1),
    ('Product Roadmap 2024', 'Product development timeline...', 'plan', 'Product', 'approved', $1),
    ('Compliance Certificate', 'ISO 27001 certification document...', 'certificate', 'Compliance', 'approved', $1),
    ('Board Meeting Minutes', 'Minutes from quarterly board meeting...', 'minutes', 'Executive', 'approved', $1),
    ('Insurance Policy', 'Company liability insurance details...', 'policy', 'Finance', 'approved', $1),
    ('Training Materials', 'New employee training content...', 'training', 'HR', 'draft', $1),
    ('Customer Case Study', 'Success story with major client...', 'marketing', 'Marketing', 'approved', $1),
    ('API Documentation', 'Technical API reference guide...', 'technical', 'Engineering', 'approved', $1),
    ('Privacy Policy', 'Data privacy and GDPR compliance...', 'policy', 'Legal', 'approved', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Approvals (15 items)
  await pool.query(`
    INSERT INTO approvals (title, description, request_type, amount, priority, status, requested_by) VALUES
    ('New Server Purchase', 'Purchase 3 new production servers', 'purchase', 45000.00, 'high', 'pending', $1),
    ('Marketing Campaign Budget', 'Q1 social media campaign', 'budget', 25000.00, 'medium', 'approved', $1),
    ('Software License Renewal', 'Annual Microsoft 365 licenses', 'purchase', 12000.00, 'high', 'pending', $1),
    ('Conference Travel', 'Team travel to tech conference', 'travel', 8500.00, 'medium', 'approved', $1),
    ('New Hire Request', 'Senior developer position', 'hiring', 120000.00, 'high', 'pending', $1),
    ('Office Renovation', 'Meeting room upgrades', 'facilities', 35000.00, 'low', 'rejected', $1),
    ('Training Program', 'Leadership training for managers', 'training', 15000.00, 'medium', 'approved', $1),
    ('Contractor Extension', 'Extend consulting engagement', 'contract', 50000.00, 'high', 'pending', $1),
    ('Equipment Upgrade', 'Developer laptop upgrades', 'purchase', 20000.00, 'medium', 'approved', $1),
    ('Vendor Payment', 'Quarterly vendor invoice payment', 'payment', 75000.00, 'high', 'pending', $1),
    ('Research Budget', 'AI research initiative funding', 'budget', 100000.00, 'high', 'pending', $1),
    ('Security Audit', 'External security assessment', 'service', 30000.00, 'high', 'approved', $1),
    ('Team Building Event', 'Annual company retreat', 'event', 18000.00, 'low', 'approved', $1),
    ('Cloud Infrastructure', 'AWS infrastructure expansion', 'purchase', 60000.00, 'high', 'pending', $1),
    ('Legal Consultation', 'IP trademark registration', 'service', 8000.00, 'medium', 'approved', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Automation Tasks (15 items)
  await pool.query(`
    INSERT INTO automation_tasks (title, description, task_type, schedule, trigger_condition, status, created_by) VALUES
    ('Daily Report Generation', 'Generate daily sales summary', 'scheduled', '0 6 * * *', NULL, 'active', $1),
    ('Invoice Reminder', 'Send reminder for overdue invoices', 'scheduled', '0 9 * * 1', NULL, 'active', $1),
    ('Backup Database', 'Automated database backup', 'scheduled', '0 2 * * *', NULL, 'active', $1),
    ('Email Classification', 'Auto-categorize incoming emails', 'trigger', NULL, 'new_email_received', 'active', $1),
    ('Contract Expiry Alert', 'Alert for expiring contracts', 'scheduled', '0 8 * * *', NULL, 'active', $1),
    ('Weekly Metrics Report', 'Compile weekly KPI report', 'scheduled', '0 7 * * 1', NULL, 'active', $1),
    ('Customer Follow-up', 'Automated follow-up emails', 'trigger', NULL, 'ticket_closed', 'active', $1),
    ('Data Sync', 'Sync data with CRM', 'scheduled', '*/30 * * * *', NULL, 'active', $1),
    ('Compliance Check', 'Daily compliance status check', 'scheduled', '0 10 * * *', NULL, 'active', $1),
    ('Inventory Alert', 'Low inventory notifications', 'trigger', NULL, 'inventory_low', 'active', $1),
    ('Meeting Reminder', 'Send meeting reminders', 'trigger', NULL, 'meeting_upcoming', 'active', $1),
    ('Password Expiry', 'Notify users of expiring passwords', 'scheduled', '0 9 * * *', NULL, 'active', $1),
    ('Performance Metrics', 'Calculate daily performance metrics', 'scheduled', '0 23 * * *', NULL, 'active', $1),
    ('Document Archive', 'Archive old documents', 'scheduled', '0 3 * * 0', NULL, 'active', $1),
    ('Security Scan', 'Automated security vulnerability scan', 'scheduled', '0 4 * * *', NULL, 'active', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Emails (15 items)
  await pool.query(`
    INSERT INTO emails (from_address, to_address, subject, body, category, priority, status) VALUES
    ('client@acme.com', 'support@company.com', 'Urgent: System Down', 'Our production system is not responding...', 'support', 'high', 'unread'),
    ('vendor@techsupply.com', 'procurement@company.com', 'Quote for Hardware', 'Please find attached our quote...', 'sales', 'medium', 'read'),
    ('hr@partner.com', 'hr@company.com', 'Partnership Inquiry', 'We are interested in discussing...', 'general', 'low', 'read'),
    ('finance@client.com', 'billing@company.com', 'Invoice Dispute', 'We need to discuss invoice #1234...', 'billing', 'high', 'unread'),
    ('marketing@agency.com', 'marketing@company.com', 'Campaign Results', 'Here are the results from Q4...', 'general', 'medium', 'read'),
    ('support@vendor.com', 'it@company.com', 'License Key Renewal', 'Your license is expiring soon...', 'support', 'medium', 'unread'),
    ('ceo@investor.com', 'executive@company.com', 'Meeting Request', 'Would like to schedule a call...', 'general', 'high', 'unread'),
    ('sales@prospect.com', 'sales@company.com', 'Product Demo Request', 'Interested in seeing a demo...', 'sales', 'high', 'read'),
    ('legal@lawfirm.com', 'legal@company.com', 'Contract Review Complete', 'We have reviewed the agreement...', 'general', 'medium', 'read'),
    ('customer@retail.com', 'support@company.com', 'Feature Request', 'We would love to see a feature...', 'support', 'low', 'read'),
    ('accounting@supplier.com', 'finance@company.com', 'Payment Confirmation', 'We confirm receipt of payment...', 'billing', 'low', 'read'),
    ('training@edu.com', 'hr@company.com', 'Training Schedule', 'Attached is the training schedule...', 'general', 'medium', 'unread'),
    ('security@alert.com', 'it@company.com', 'Security Alert', 'Suspicious activity detected...', 'support', 'high', 'unread'),
    ('feedback@customer.com', 'support@company.com', 'Great Service!', 'Just wanted to say thank you...', 'general', 'low', 'read'),
    ('press@media.com', 'pr@company.com', 'Interview Request', 'Would like to feature your company...', 'general', 'medium', 'unread')
    ON CONFLICT DO NOTHING
  `);

  // Seed Invoices (15 items)
  await pool.query(`
    INSERT INTO invoices (invoice_number, vendor_name, amount, due_date, description, category, status, created_by) VALUES
    ('INV-2024-001', 'TechSupply Inc', 15000.00, '2024-02-15', 'Server hardware purchase', 'IT Equipment', 'pending', $1),
    ('INV-2024-002', 'CloudServices LLC', 8500.00, '2024-02-20', 'Monthly cloud hosting', 'Services', 'approved', $1),
    ('INV-2024-003', 'Office Plus', 3200.00, '2024-02-10', 'Office supplies', 'Supplies', 'paid', $1),
    ('INV-2024-004', 'Marketing Pro', 25000.00, '2024-02-28', 'Q1 marketing campaign', 'Marketing', 'pending', $1),
    ('INV-2024-005', 'Legal Associates', 12000.00, '2024-02-25', 'Legal consultation', 'Professional Services', 'approved', $1),
    ('INV-2024-006', 'Training Corp', 8000.00, '2024-03-01', 'Employee training program', 'Training', 'pending', $1),
    ('INV-2024-007', 'Utility Company', 4500.00, '2024-02-15', 'Monthly utilities', 'Utilities', 'paid', $1),
    ('INV-2024-008', 'Security Systems', 18000.00, '2024-02-20', 'Security system upgrade', 'Security', 'pending', $1),
    ('INV-2024-009', 'Consulting Group', 35000.00, '2024-03-05', 'Strategy consulting', 'Consulting', 'pending', $1),
    ('INV-2024-010', 'Print Services', 2800.00, '2024-02-12', 'Marketing materials printing', 'Marketing', 'paid', $1),
    ('INV-2024-011', 'Insurance Corp', 15000.00, '2024-02-28', 'Quarterly insurance premium', 'Insurance', 'approved', $1),
    ('INV-2024-012', 'Travel Agency', 9500.00, '2024-02-18', 'Business travel expenses', 'Travel', 'paid', $1),
    ('INV-2024-013', 'Software Vendor', 22000.00, '2024-03-10', 'Annual software licenses', 'Software', 'pending', $1),
    ('INV-2024-014', 'Maintenance Co', 6500.00, '2024-02-22', 'Facility maintenance', 'Maintenance', 'approved', $1),
    ('INV-2024-015', 'Telecom Provider', 5800.00, '2024-02-15', 'Monthly telecom services', 'Telecom', 'paid', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Contracts (15 items)
  await pool.query(`
    INSERT INTO contracts (title, party_name, contract_type, value, start_date, end_date, terms, status, created_by) VALUES
    ('Cloud Infrastructure Agreement', 'AWS Inc', 'Service', 120000.00, '2024-01-01', '2024-12-31', 'Annual cloud services agreement with SLA guarantees', 'active', $1),
    ('Software Development Contract', 'TechDev Solutions', 'Development', 250000.00, '2024-01-15', '2024-07-15', 'Custom software development with milestone payments', 'active', $1),
    ('Office Lease Agreement', 'Commercial Properties LLC', 'Lease', 180000.00, '2024-01-01', '2026-12-31', '3-year office space lease with renewal option', 'active', $1),
    ('Marketing Agency Retainer', 'Creative Marketing Co', 'Retainer', 60000.00, '2024-01-01', '2024-12-31', 'Monthly retainer for marketing services', 'active', $1),
    ('IT Support Contract', 'TechSupport Inc', 'Service', 48000.00, '2024-01-01', '2024-12-31', '24/7 IT support with 4-hour response time', 'active', $1),
    ('Consulting Agreement', 'Strategy Partners', 'Consulting', 150000.00, '2024-02-01', '2024-08-31', 'Business strategy consulting engagement', 'draft', $1),
    ('Equipment Lease', 'Tech Equipment Co', 'Lease', 36000.00, '2024-01-01', '2025-12-31', 'IT equipment lease with maintenance included', 'active', $1),
    ('NDA with Partner', 'Innovative Tech Corp', 'NDA', 0.00, '2024-01-01', '2026-01-01', 'Mutual non-disclosure agreement', 'active', $1),
    ('Distribution Agreement', 'Global Distributors', 'Distribution', 500000.00, '2024-01-01', '2024-12-31', 'Product distribution in North America', 'active', $1),
    ('Maintenance Contract', 'Facility Services Inc', 'Service', 72000.00, '2024-01-01', '2024-12-31', 'Annual facility maintenance agreement', 'active', $1),
    ('HR Services Agreement', 'PeopleFirst HR', 'Service', 84000.00, '2024-01-01', '2024-12-31', 'HR outsourcing services', 'active', $1),
    ('Insurance Policy', 'SecureInsurance Co', 'Insurance', 45000.00, '2024-01-01', '2024-12-31', 'Comprehensive business insurance', 'active', $1),
    ('Partnership Agreement', 'Tech Alliance Inc', 'Partnership', 0.00, '2024-02-01', '2025-01-31', 'Strategic technology partnership', 'draft', $1),
    ('Vendor Supply Agreement', 'Quality Supplies Ltd', 'Supply', 200000.00, '2024-01-01', '2024-12-31', 'Preferred vendor supply agreement', 'active', $1),
    ('Training Services Contract', 'Professional Training Co', 'Service', 35000.00, '2024-03-01', '2024-12-31', 'Corporate training program delivery', 'pending', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Tickets (15 items)
  await pool.query(`
    INSERT INTO tickets (title, description, category, priority, customer_name, customer_email, status, created_by) VALUES
    ('Login Issues', 'Cannot access the dashboard after password reset', 'Technical', 'high', 'John Smith', 'john@client.com', 'open', $1),
    ('Billing Question', 'Need clarification on last invoice charges', 'Billing', 'medium', 'Sarah Johnson', 'sarah@company.com', 'in_progress', $1),
    ('Feature Request', 'Would like to export reports to PDF', 'Feature', 'low', 'Mike Wilson', 'mike@startup.com', 'open', $1),
    ('Performance Issue', 'Dashboard loading very slowly', 'Technical', 'high', 'Emily Brown', 'emily@enterprise.com', 'in_progress', $1),
    ('Account Setup', 'Need help setting up team accounts', 'Support', 'medium', 'David Lee', 'david@agency.com', 'resolved', $1),
    ('Integration Help', 'API integration returning errors', 'Technical', 'high', 'Lisa Chen', 'lisa@techco.com', 'open', $1),
    ('Refund Request', 'Requesting refund for unused subscription', 'Billing', 'medium', 'Tom Garcia', 'tom@retail.com', 'in_progress', $1),
    ('Data Export', 'Need to export all historical data', 'Support', 'low', 'Anna Martinez', 'anna@consulting.com', 'open', $1),
    ('Security Concern', 'Suspicious activity on account', 'Security', 'high', 'Robert Taylor', 'robert@finance.com', 'in_progress', $1),
    ('Mobile App Bug', 'App crashes when uploading images', 'Technical', 'medium', 'Jennifer White', 'jennifer@media.com', 'open', $1),
    ('Upgrade Request', 'Want to upgrade to enterprise plan', 'Sales', 'medium', 'Chris Anderson', 'chris@bigcorp.com', 'resolved', $1),
    ('Training Request', 'Team needs product training', 'Support', 'low', 'Michelle Thomas', 'michelle@edu.com', 'open', $1),
    ('Downtime Report', 'Service was unavailable for 30 minutes', 'Technical', 'high', 'Kevin Jackson', 'kevin@ecommerce.com', 'resolved', $1),
    ('Password Reset', 'Forgot password and cannot reset', 'Support', 'medium', 'Amanda Harris', 'amanda@healthcare.com', 'resolved', $1),
    ('Custom Report', 'Need custom analytics report setup', 'Feature', 'low', 'Brian Clark', 'brian@analytics.com', 'open', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Onboarding (15 items)
  await pool.query(`
    INSERT INTO onboarding (employee_name, email, role, department, start_date, manager, tasks, progress, status, created_by) VALUES
    ('Alex Thompson', 'alex.t@company.com', 'Senior Developer', 'Engineering', '2024-02-01', 'Sarah Manager', '["IT Setup", "Code Review Training", "Team Introduction"]', 75, 'in_progress', $1),
    ('Maria Garcia', 'maria.g@company.com', 'Marketing Manager', 'Marketing', '2024-02-05', 'John Director', '["Brand Guidelines", "Campaign Overview", "Tools Access"]', 50, 'in_progress', $1),
    ('James Wilson', 'james.w@company.com', 'Sales Representative', 'Sales', '2024-02-10', 'Mike Lead', '["CRM Training", "Product Knowledge", "Territory Assignment"]', 25, 'pending', $1),
    ('Emma Davis', 'emma.d@company.com', 'HR Coordinator', 'HR', '2024-01-15', 'Lisa HR Director', '["Policy Review", "System Training", "Benefits Orientation"]', 100, 'completed', $1),
    ('William Brown', 'william.b@company.com', 'Finance Analyst', 'Finance', '2024-02-15', 'Robert CFO', '["Financial Systems", "Reporting Tools", "Compliance Training"]', 0, 'pending', $1),
    ('Olivia Johnson', 'olivia.j@company.com', 'Product Designer', 'Product', '2024-01-20', 'Emily Product Lead', '["Design System", "Prototyping Tools", "User Research"]', 90, 'in_progress', $1),
    ('Benjamin Lee', 'ben.l@company.com', 'DevOps Engineer', 'Engineering', '2024-02-08', 'Sarah Manager', '["Infrastructure Access", "CI/CD Pipeline", "Security Protocols"]', 60, 'in_progress', $1),
    ('Sophia Martinez', 'sophia.m@company.com', 'Customer Success Manager', 'Customer Success', '2024-01-25', 'Tom CS Director', '["Client Portfolio", "Support Tools", "Escalation Process"]', 100, 'completed', $1),
    ('Ethan Anderson', 'ethan.a@company.com', 'Data Scientist', 'Data', '2024-02-12', 'Jennifer Data Lead', '["Data Platform Access", "ML Tools", "Privacy Training"]', 30, 'in_progress', $1),
    ('Ava Thomas', 'ava.t@company.com', 'Content Writer', 'Marketing', '2024-02-18', 'John Director', '["Style Guide", "CMS Training", "SEO Guidelines"]', 0, 'pending', $1),
    ('Noah Jackson', 'noah.j@company.com', 'IT Support Specialist', 'IT', '2024-01-28', 'Kevin IT Manager', '["Ticketing System", "Hardware Inventory", "VPN Setup"]', 85, 'in_progress', $1),
    ('Isabella White', 'isabella.w@company.com', 'Legal Counsel', 'Legal', '2024-02-20', 'Amanda General Counsel', '["Contract Templates", "Compliance Framework", "Legal Tools"]', 0, 'pending', $1),
    ('Mason Harris', 'mason.h@company.com', 'QA Engineer', 'Engineering', '2024-02-03', 'Sarah Manager', '["Testing Framework", "Bug Tracking", "Automation Tools"]', 70, 'in_progress', $1),
    ('Charlotte Clark', 'charlotte.c@company.com', 'Account Executive', 'Sales', '2024-01-30', 'Mike Lead', '["Sales Process", "Client Database", "Proposal Templates"]', 100, 'completed', $1),
    ('Liam Robinson', 'liam.r@company.com', 'UX Researcher', 'Product', '2024-02-22', 'Emily Product Lead', '["Research Methods", "User Testing Platform", "Analytics Tools"]', 0, 'pending', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Expenses (15 items)
  await pool.query(`
    INSERT INTO expenses (title, amount, category, description, expense_date, status, submitted_by) VALUES
    ('Client Lunch Meeting', 125.50, 'Meals', 'Business lunch with potential client', '2024-01-20', 'approved', $1),
    ('Conference Registration', 850.00, 'Training', 'Annual tech conference registration', '2024-01-15', 'approved', $1),
    ('Flight to NYC', 450.00, 'Travel', 'Round trip for client meeting', '2024-01-25', 'pending', $1),
    ('Hotel Stay NYC', 320.00, 'Travel', '2 nights accommodation', '2024-01-26', 'pending', $1),
    ('Office Supplies', 89.99, 'Supplies', 'Notebooks and pens for team', '2024-01-18', 'approved', $1),
    ('Software Subscription', 199.00, 'Software', 'Annual design tool subscription', '2024-01-10', 'approved', $1),
    ('Uber Rides', 75.80, 'Travel', 'Local transportation for week', '2024-01-22', 'approved', $1),
    ('Team Dinner', 380.00, 'Meals', 'Quarterly team dinner', '2024-01-28', 'pending', $1),
    ('Phone Bill Reimbursement', 85.00, 'Telecom', 'Monthly phone bill', '2024-01-15', 'approved', $1),
    ('Training Course', 299.00, 'Training', 'Online certification course', '2024-01-12', 'approved', $1),
    ('Parking Fees', 65.00, 'Travel', 'Weekly parking at office', '2024-01-21', 'approved', $1),
    ('Client Gift', 150.00, 'Entertainment', 'Thank you gift for major client', '2024-01-30', 'pending', $1),
    ('Equipment Repair', 175.00, 'Equipment', 'Laptop screen repair', '2024-01-08', 'approved', $1),
    ('Books and Materials', 95.50, 'Training', 'Professional development books', '2024-01-14', 'approved', $1),
    ('Coworking Space', 200.00, 'Facilities', 'Monthly coworking membership', '2024-01-01', 'approved', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Meetings (15 items)
  await pool.query(`
    INSERT INTO meetings (title, description, meeting_date, duration, participants, location, meeting_type, status, organizer) VALUES
    ('Weekly Team Standup', 'Regular team sync meeting', '2024-02-05 09:00:00', 30, '["Team Lead", "Developers", "QA"]', 'Conference Room A', 'standup', 'scheduled', $1),
    ('Q1 Planning Session', 'Quarterly planning and goal setting', '2024-02-10 10:00:00', 180, '["Department Heads", "Executive Team"]', 'Board Room', 'planning', 'scheduled', $1),
    ('Client Demo', 'Product demonstration for Enterprise client', '2024-02-08 14:00:00', 60, '["Sales Team", "Product Manager", "Client"]', 'Virtual', 'demo', 'scheduled', $1),
    ('Sprint Retrospective', 'Sprint review and improvements', '2024-02-07 15:00:00', 60, '["Development Team", "Scrum Master"]', 'Conference Room B', 'retrospective', 'scheduled', $1),
    ('Budget Review', 'Monthly budget review meeting', '2024-02-12 11:00:00', 90, '["Finance Team", "Department Heads"]', 'Finance Office', 'review', 'scheduled', $1),
    ('New Hire Orientation', 'Orientation for new employees', '2024-02-15 09:00:00', 240, '["HR Team", "New Hires"]', 'Training Room', 'training', 'scheduled', $1),
    ('Product Roadmap Review', 'Review and update product roadmap', '2024-02-09 13:00:00', 120, '["Product Team", "Engineering Leads"]', 'Product Office', 'planning', 'scheduled', $1),
    ('Vendor Meeting', 'Meeting with key vendor partner', '2024-02-14 10:00:00', 60, '["Procurement", "IT Team", "Vendor"]', 'Virtual', 'external', 'scheduled', $1),
    ('All Hands Meeting', 'Monthly company-wide meeting', '2024-02-20 16:00:00', 60, '["All Employees"]', 'Main Hall', 'all-hands', 'scheduled', $1),
    ('Security Training', 'Mandatory security awareness training', '2024-02-16 14:00:00', 90, '["All Employees"]', 'Virtual', 'training', 'scheduled', $1),
    ('Interview - Senior Dev', 'Technical interview for senior developer', '2024-02-06 11:00:00', 60, '["Hiring Manager", "Tech Lead"]', 'Interview Room', 'interview', 'completed', $1),
    ('Marketing Strategy', 'Q1 marketing campaign planning', '2024-02-13 09:00:00', 120, '["Marketing Team", "Creative Director"]', 'Marketing Office', 'planning', 'scheduled', $1),
    ('Customer Feedback Review', 'Review recent customer feedback', '2024-02-11 15:00:00', 60, '["Product Team", "Customer Success"]', 'Conference Room C', 'review', 'scheduled', $1),
    ('Board Meeting', 'Quarterly board of directors meeting', '2024-02-25 10:00:00', 180, '["Board Members", "Executive Team"]', 'Board Room', 'board', 'scheduled', $1),
    ('One-on-One', 'Weekly manager one-on-one', '2024-02-05 14:00:00', 30, '["Manager", "Direct Report"]', 'Manager Office', '1on1', 'completed', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Reports (15 items)
  await pool.query(`
    INSERT INTO reports (title, report_type, description, data_source, schedule, status, created_by) VALUES
    ('Daily Sales Summary', 'sales', 'Daily summary of sales performance', 'CRM', 'daily', 'generated', $1),
    ('Weekly Revenue Report', 'financial', 'Weekly revenue and expenses overview', 'Accounting System', 'weekly', 'generated', $1),
    ('Monthly KPI Dashboard', 'performance', 'Key performance indicators for all departments', 'Multiple Sources', 'monthly', 'generated', $1),
    ('Customer Churn Analysis', 'analytics', 'Analysis of customer churn patterns', 'Customer Database', 'monthly', 'draft', $1),
    ('Employee Engagement Survey', 'hr', 'Results from quarterly engagement survey', 'Survey Platform', 'quarterly', 'generated', $1),
    ('Inventory Status Report', 'operations', 'Current inventory levels and forecasts', 'Inventory System', 'weekly', 'generated', $1),
    ('Marketing Campaign ROI', 'marketing', 'Return on investment for marketing campaigns', 'Marketing Platform', 'monthly', 'generated', $1),
    ('IT Infrastructure Health', 'technical', 'System uptime and performance metrics', 'Monitoring Tools', 'daily', 'generated', $1),
    ('Compliance Status Report', 'compliance', 'Current compliance status across regulations', 'Compliance System', 'monthly', 'generated', $1),
    ('Budget Variance Analysis', 'financial', 'Comparison of actual vs budgeted expenses', 'Accounting System', 'monthly', 'generated', $1),
    ('Customer Satisfaction Score', 'customer', 'NPS and satisfaction metrics', 'Survey Platform', 'weekly', 'generated', $1),
    ('Project Status Summary', 'project', 'Status of all active projects', 'Project Management', 'weekly', 'generated', $1),
    ('Vendor Performance Report', 'procurement', 'Vendor delivery and quality metrics', 'Procurement System', 'monthly', 'draft', $1),
    ('Security Incident Report', 'security', 'Summary of security incidents and responses', 'Security Platform', 'weekly', 'generated', $1),
    ('Training Completion Report', 'hr', 'Employee training completion rates', 'LMS', 'monthly', 'generated', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Data Entries (15 items)
  await pool.query(`
    INSERT INTO data_entries (title, source_type, raw_data, extracted_data, fields_schema, status, created_by) VALUES
    ('Invoice from TechCorp', 'invoice', 'Invoice #12345\nDate: 2024-01-15\nAmount: $5,000\nVendor: TechCorp Inc', '{"invoice_number": "12345", "date": "2024-01-15", "amount": 5000}', '["invoice_number", "date", "amount", "vendor"]', 'extracted', $1),
    ('Customer Feedback Email', 'email', 'From: customer@example.com\nSubject: Great product!\nWe love using your software...', '{"sender": "customer@example.com", "sentiment": "positive"}', '["sender", "subject", "sentiment"]', 'extracted', $1),
    ('Business Card Scan', 'image', 'John Smith\nSenior Developer\nTech Company\njohn@tech.com\n555-1234', '{"name": "John Smith", "title": "Senior Developer", "email": "john@tech.com"}', '["name", "title", "company", "email", "phone"]', 'extracted', $1),
    ('Purchase Order #4567', 'document', 'PO #4567\nVendor: Office Supplies Inc\nItems: Various office supplies\nTotal: $1,250', '{"po_number": "4567", "vendor": "Office Supplies Inc", "total": 1250}', '["po_number", "vendor", "items", "total"]', 'extracted', $1),
    ('Meeting Notes 2024-01-20', 'notes', 'Attendees: John, Sarah, Mike\nTopics: Q1 Planning\nAction Items: Complete budget by Friday', '{"attendees": ["John", "Sarah", "Mike"], "topics": ["Q1 Planning"]}', '["attendees", "topics", "action_items"]', 'extracted', $1),
    ('Contract Terms Document', 'contract', 'Agreement between Company A and Company B\nStart Date: Feb 1, 2024\nValue: $100,000', '{"parties": ["Company A", "Company B"], "start_date": "2024-02-01", "value": 100000}', '["parties", "start_date", "end_date", "value"]', 'pending', $1),
    ('Expense Receipt', 'receipt', 'Restaurant ABC\nDate: 01/18/2024\nTotal: $125.50\nTip: $25.00', '{"merchant": "Restaurant ABC", "date": "2024-01-18", "total": 125.50}', '["merchant", "date", "total", "category"]', 'extracted', $1),
    ('Survey Response Data', 'survey', 'Q1: Very Satisfied\nQ2: Would recommend\nQ3: Been using for 2 years', '{"satisfaction": "Very Satisfied", "nps": 9, "tenure": "2 years"}', '["satisfaction", "nps", "tenure"]', 'extracted', $1),
    ('Job Application', 'form', 'Name: Jane Doe\nPosition: Marketing Manager\nExperience: 5 years\nSalary Expectation: $80,000', '{"name": "Jane Doe", "position": "Marketing Manager", "experience": "5 years"}', '["name", "position", "experience", "salary"]', 'pending', $1),
    ('Shipping Label', 'label', 'Ship To: 123 Main St, City, ST 12345\nFrom: Warehouse A\nWeight: 5 lbs', '{"destination": "123 Main St, City, ST 12345", "weight": "5 lbs"}', '["destination", "origin", "weight"]', 'extracted', $1),
    ('Insurance Claim Form', 'form', 'Claim #: CLM-2024-001\nType: Property Damage\nAmount: $15,000\nDate of Loss: 01/10/2024', '{"claim_number": "CLM-2024-001", "type": "Property Damage", "amount": 15000}', '["claim_number", "type", "amount", "date"]', 'pending', $1),
    ('Conference Badge', 'image', 'Tech Conference 2024\nJohn Smith\nSenior Developer\nCompany XYZ', '{"event": "Tech Conference 2024", "name": "John Smith"}', '["event", "name", "title", "company"]', 'extracted', $1),
    ('Bank Statement Entry', 'statement', 'Transaction: Wire Transfer\nAmount: $50,000\nDate: 01/15/2024\nReference: REF12345', '{"transaction_type": "Wire Transfer", "amount": 50000, "reference": "REF12345"}', '["transaction_type", "amount", "date", "reference"]', 'extracted', $1),
    ('Product Return Form', 'form', 'Order #: ORD-5678\nReason: Defective\nRefund Amount: $199.99', '{"order_number": "ORD-5678", "reason": "Defective", "refund": 199.99}', '["order_number", "reason", "refund"]', 'extracted', $1),
    ('Timesheet Entry', 'form', 'Employee: Mike Johnson\nWeek: 01/15-01/21\nHours: 42\nProject: Client ABC', '{"employee": "Mike Johnson", "hours": 42, "project": "Client ABC"}', '["employee", "week", "hours", "project"]', 'pending', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Compliance (15 items)
  await pool.query(`
    INSERT INTO compliance (title, regulation_type, requirement, current_status, due_date, responsible_party, status, created_by) VALUES
    ('GDPR Data Processing', 'GDPR', 'Maintain records of data processing activities', 'Documentation up to date', '2024-06-30', 'Data Protection Officer', 'compliant', $1),
    ('SOC 2 Type II Audit', 'SOC 2', 'Annual SOC 2 Type II certification', 'Audit scheduled for Q2', '2024-04-15', 'IT Security Team', 'in_progress', $1),
    ('PCI DSS Compliance', 'PCI DSS', 'Maintain PCI DSS Level 1 certification', 'Last assessment completed Jan 2024', '2024-12-31', 'IT Security Team', 'compliant', $1),
    ('HIPAA Privacy Rule', 'HIPAA', 'Implement required privacy safeguards', 'Privacy policies reviewed', '2024-03-31', 'Compliance Officer', 'compliant', $1),
    ('ISO 27001 Certification', 'ISO 27001', 'Maintain information security certification', 'Surveillance audit due', '2024-05-20', 'IT Security Team', 'in_progress', $1),
    ('ADA Website Accessibility', 'ADA', 'Ensure website meets WCAG 2.1 AA standards', 'Accessibility audit needed', '2024-06-30', 'Web Development Team', 'pending', $1),
    ('CCPA Consumer Rights', 'CCPA', 'Implement consumer rights request process', 'Process in place, needs testing', '2024-03-15', 'Legal Team', 'in_progress', $1),
    ('Financial Reporting (SOX)', 'SOX', 'Maintain internal controls for financial reporting', 'Controls documented and tested', '2024-03-31', 'Finance Team', 'compliant', $1),
    ('Employee Safety (OSHA)', 'OSHA', 'Maintain workplace safety standards', 'Safety training completed', '2024-12-31', 'HR Team', 'compliant', $1),
    ('Data Retention Policy', 'Internal', 'Implement data retention and deletion policy', 'Policy draft under review', '2024-04-30', 'Legal Team', 'in_progress', $1),
    ('Third-Party Risk Management', 'Internal', 'Assess and monitor third-party vendors', 'Vendor assessments 80% complete', '2024-05-31', 'Procurement Team', 'in_progress', $1),
    ('Business Continuity Plan', 'Internal', 'Annual BCP review and testing', 'BCP test scheduled for Q2', '2024-06-15', 'IT Operations', 'pending', $1),
    ('Export Control Compliance', 'EAR/ITAR', 'Ensure compliance with export regulations', 'Training completed', '2024-12-31', 'Legal Team', 'compliant', $1),
    ('Anti-Money Laundering', 'AML', 'Implement AML screening procedures', 'Screening system active', '2024-12-31', 'Compliance Team', 'compliant', $1),
    ('Employee Background Checks', 'Internal', 'Conduct background checks for all new hires', 'Process in place', '2024-12-31', 'HR Team', 'compliant', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Vendors (15 items)
  await pool.query(`
    INSERT INTO vendors (name, category, contact_name, contact_email, contact_phone, address, contract_value, contract_start, contract_end, rating, status, created_by) VALUES
    ('TechSupply Inc', 'IT Equipment', 'John Smith', 'john@techsupply.com', '555-0101', '123 Tech Blvd, Silicon Valley, CA', 150000.00, '2024-01-01', '2024-12-31', 5, 'active', $1),
    ('CloudServices LLC', 'Cloud Hosting', 'Sarah Johnson', 'sarah@cloudservices.com', '555-0102', '456 Cloud Ave, Seattle, WA', 120000.00, '2024-01-01', '2024-12-31', 5, 'active', $1),
    ('Office Plus', 'Office Supplies', 'Mike Brown', 'mike@officeplus.com', '555-0103', '789 Supply St, Chicago, IL', 25000.00, '2024-01-01', '2024-12-31', 4, 'active', $1),
    ('Marketing Pro', 'Marketing Services', 'Emily Davis', 'emily@marketingpro.com', '555-0104', '321 Creative Dr, New York, NY', 80000.00, '2024-01-01', '2024-12-31', 4, 'active', $1),
    ('Legal Associates', 'Legal Services', 'Robert Wilson', 'robert@legalassociates.com', '555-0105', '567 Law Center, Boston, MA', 60000.00, '2024-01-01', '2024-12-31', 5, 'active', $1),
    ('Training Corp', 'Training Services', 'Lisa Anderson', 'lisa@trainingcorp.com', '555-0106', '890 Education Ln, Austin, TX', 45000.00, '2024-01-01', '2024-12-31', 4, 'active', $1),
    ('Security Systems', 'Security', 'David Martinez', 'david@securitysystems.com', '555-0107', '234 Safe Way, Denver, CO', 75000.00, '2024-01-01', '2024-12-31', 5, 'active', $1),
    ('Consulting Group', 'Consulting', 'Jennifer Taylor', 'jennifer@consultinggroup.com', '555-0108', '678 Strategy Blvd, Miami, FL', 200000.00, '2024-01-01', '2024-12-31', 4, 'active', $1),
    ('Print Services', 'Printing', 'Chris Thomas', 'chris@printservices.com', '555-0109', '901 Print Ave, Atlanta, GA', 15000.00, '2024-01-01', '2024-12-31', 3, 'active', $1),
    ('Insurance Corp', 'Insurance', 'Amanda White', 'amanda@insurancecorp.com', '555-0110', '345 Coverage Rd, Phoenix, AZ', 50000.00, '2024-01-01', '2024-12-31', 4, 'active', $1),
    ('Travel Agency', 'Travel', 'Kevin Harris', 'kevin@travelagency.com', '555-0111', '678 Journey St, Las Vegas, NV', 35000.00, '2024-01-01', '2024-12-31', 4, 'active', $1),
    ('Software Vendor', 'Software', 'Michelle Clark', 'michelle@softwarevendor.com', '555-0112', '123 Code Way, San Francisco, CA', 100000.00, '2024-01-01', '2024-12-31', 5, 'active', $1),
    ('Maintenance Co', 'Facilities', 'Brian Lewis', 'brian@maintenanceco.com', '555-0113', '456 Service Dr, Portland, OR', 40000.00, '2024-01-01', '2024-12-31', 4, 'active', $1),
    ('Telecom Provider', 'Telecom', 'Rachel Walker', 'rachel@telecomprovider.com', '555-0114', '789 Connect Blvd, Dallas, TX', 30000.00, '2024-01-01', '2024-12-31', 3, 'active', $1),
    ('Catering Services', 'Food Services', 'Steven Hall', 'steven@cateringservices.com', '555-0115', '901 Gourmet Ave, Houston, TX', 20000.00, '2024-01-01', '2024-12-31', 5, 'active', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // ============================================
  // SEED NEW OPERATIONS TABLES (15 items each)
  // ============================================

  // Seed Process Mining (15 items)
  await pool.query(`
    INSERT INTO process_mining (name, description, process_type, event_log, department, complexity, status, created_by) VALUES
    ('Invoice Processing', 'End-to-end invoice processing from receipt to payment', 'Financial', 'Receive Invoice -> Validate -> Approve -> Schedule Payment -> Execute Payment', 'Finance', 'medium', 'pending', $1),
    ('Customer Onboarding', 'New customer account setup and activation', 'Customer Service', 'Application -> Verification -> Account Creation -> Welcome Email -> First Login', 'Sales', 'high', 'pending', $1),
    ('Order Fulfillment', 'Order processing from placement to delivery', 'Operations', 'Order Placed -> Inventory Check -> Pick -> Pack -> Ship -> Deliver', 'Operations', 'high', 'analyzed', $1),
    ('Employee Leave Request', 'Leave request approval process', 'HR', 'Submit Request -> Manager Review -> HR Approval -> Calendar Update -> Notification', 'HR', 'low', 'pending', $1),
    ('IT Ticket Resolution', 'IT support ticket lifecycle', 'Support', 'Ticket Created -> Triage -> Assign -> Investigate -> Resolve -> Close', 'IT', 'medium', 'analyzed', $1),
    ('Purchase Requisition', 'Purchase request to order process', 'Procurement', 'Request -> Budget Check -> Approvals -> PO Creation -> Vendor Selection -> Order', 'Procurement', 'high', 'pending', $1),
    ('Loan Application', 'Loan processing workflow', 'Financial', 'Application -> Credit Check -> Document Review -> Approval -> Disbursement', 'Finance', 'high', 'pending', $1),
    ('Product Return', 'Customer return and refund process', 'Customer Service', 'Return Request -> Validation -> Shipping Label -> Receive -> Inspect -> Refund', 'Operations', 'medium', 'analyzed', $1),
    ('Contract Renewal', 'Contract renewal negotiation process', 'Legal', 'Expiry Alert -> Review Terms -> Negotiation -> Legal Review -> Sign -> Activate', 'Legal', 'medium', 'pending', $1),
    ('Expense Reimbursement', 'Employee expense claim process', 'Finance', 'Submit Claim -> Manager Approval -> Finance Review -> Compliance Check -> Payment', 'Finance', 'low', 'analyzed', $1),
    ('Recruitment Process', 'Hiring from requisition to onboarding', 'HR', 'Requisition -> Job Posting -> Screening -> Interviews -> Offer -> Onboarding', 'HR', 'high', 'pending', $1),
    ('Incident Management', 'Production incident response process', 'IT', 'Detection -> Alert -> Triage -> Response -> Resolution -> Post-mortem', 'IT', 'high', 'pending', $1),
    ('Vendor Evaluation', 'New vendor assessment and approval', 'Procurement', 'RFP -> Submissions -> Evaluation -> Shortlist -> Negotiation -> Contract', 'Procurement', 'medium', 'analyzed', $1),
    ('Quality Inspection', 'Product quality control process', 'Operations', 'Sample -> Visual Check -> Test -> Measure -> Document -> Approve/Reject', 'Operations', 'medium', 'pending', $1),
    ('Campaign Launch', 'Marketing campaign execution process', 'Marketing', 'Brief -> Creative -> Review -> Assets -> Channel Setup -> Launch -> Monitor', 'Marketing', 'high', 'pending', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Workflow Optimizations (15 items)
  await pool.query(`
    INSERT INTO workflow_optimizations (name, workflow_description, current_steps, bottlenecks, goals, priority, status, created_by) VALUES
    ('Invoice Approval Speed', 'Reduce invoice approval cycle time', 'Manual review -> Manager approval -> Finance check -> Payment scheduling', 'Manager availability, manual data entry', 'Reduce cycle time from 5 days to 1 day', 'high', 'pending', $1),
    ('Customer Support Response', 'Improve first response time for tickets', 'Ticket received -> Queue -> Assignment -> Initial response', 'Manual assignment, high queue volume', 'Achieve < 1 hour first response', 'high', 'optimized', $1),
    ('Onboarding Efficiency', 'Streamline new hire onboarding', '15 manual steps across 4 departments', 'Coordination delays, document collection', 'Complete onboarding in 2 days vs 2 weeks', 'medium', 'pending', $1),
    ('Order Processing', 'Optimize order-to-shipment workflow', 'Order entry -> Inventory check -> Pick -> Pack -> Label -> Ship', 'Manual inventory lookup, label printing', 'Same-day shipping for orders before 2pm', 'high', 'pending', $1),
    ('Contract Review Cycle', 'Speed up contract approval process', 'Draft -> Legal review -> Stakeholder review -> Revision -> Sign', 'Multiple revision cycles, slow feedback', 'Reduce from 3 weeks to 1 week', 'medium', 'optimized', $1),
    ('Expense Processing', 'Automate expense report handling', 'Submit -> Manager review -> Finance audit -> Approval -> Payment', 'Receipt validation, policy checking', 'Auto-approve compliant expenses', 'medium', 'pending', $1),
    ('Lead Qualification', 'Improve lead scoring and routing', 'Lead capture -> Manual scoring -> Assignment -> Follow-up', 'Inconsistent scoring, slow routing', 'Real-time scoring and instant routing', 'high', 'pending', $1),
    ('IT Change Management', 'Streamline change request process', 'Request -> CAB review -> Approval chain -> Implementation -> Verification', 'Weekly CAB meetings, documentation', 'Enable fast-track for low-risk changes', 'medium', 'optimized', $1),
    ('Purchase Approval', 'Optimize purchase requisition workflow', 'Request -> Budget check -> Dept approval -> Procurement -> PO', 'Multiple approval layers, budget queries', 'Auto-approve within budget thresholds', 'high', 'pending', $1),
    ('Report Generation', 'Automate recurring report creation', 'Data collection -> Compilation -> Formatting -> Review -> Distribution', 'Manual data gathering, formatting time', 'Fully automated daily reports', 'low', 'pending', $1),
    ('Incident Escalation', 'Improve critical incident handling', 'Detection -> Assessment -> Escalation -> Response -> Resolution', 'Manual escalation, unclear severity', 'Automatic escalation based on impact', 'high', 'optimized', $1),
    ('Training Completion', 'Improve training program completion', 'Enrollment -> Scheduling -> Attendance -> Assessment -> Certification', 'Scheduling conflicts, low engagement', 'Achieve 95% completion rate', 'medium', 'pending', $1),
    ('Vendor Payments', 'Optimize vendor payment process', 'Invoice match -> Approval -> Scheduling -> Execution -> Reconciliation', '3-way match delays, manual scheduling', 'Automate routine payment processing', 'medium', 'pending', $1),
    ('Customer Feedback Loop', 'Close feedback to action cycle', 'Collect -> Categorize -> Route -> Action -> Follow-up', 'Manual categorization, no tracking', 'Automated routing with SLA tracking', 'low', 'pending', $1),
    ('Compliance Audit Prep', 'Streamline audit preparation', 'Evidence collection -> Documentation -> Review -> Submission', 'Scattered evidence, manual compilation', 'Continuous compliance readiness', 'medium', 'optimized', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed RPA Scripts (15 items)
  await pool.query(`
    INSERT INTO rpa_scripts (name, task_description, platform, input_data, output_format, complexity, status, created_by) VALUES
    ('Invoice Data Entry', 'Extract data from PDF invoices and enter into ERP', 'UiPath', 'PDF invoices from email attachments', 'ERP system entries', 'medium', 'pending', $1),
    ('Employee Data Sync', 'Sync HR data between HRIS and payroll system', 'Blue Prism', 'HRIS employee records', 'Payroll system updates', 'low', 'generated', $1),
    ('Report Distribution', 'Generate and email weekly reports to stakeholders', 'Automation Anywhere', 'Database queries, email list', 'PDF reports via email', 'low', 'generated', $1),
    ('Order Entry Automation', 'Enter orders from Excel into order management system', 'UiPath', 'Excel order files', 'Order management entries', 'medium', 'pending', $1),
    ('Bank Reconciliation', 'Match bank statements with accounting records', 'Blue Prism', 'Bank statements, GL entries', 'Reconciliation report', 'high', 'pending', $1),
    ('Customer Data Migration', 'Migrate customer data between CRM systems', 'UiPath', 'Legacy CRM export', 'New CRM imports', 'high', 'pending', $1),
    ('PO Generation', 'Create purchase orders from approved requisitions', 'Automation Anywhere', 'Approved requisitions', 'PO documents in ERP', 'medium', 'generated', $1),
    ('Inventory Updates', 'Update inventory levels from supplier portals', 'UiPath', 'Supplier portal data', 'Inventory system updates', 'medium', 'pending', $1),
    ('Claims Processing', 'Process insurance claims from submission forms', 'Blue Prism', 'Claim submission forms', 'Claims system entries', 'high', 'pending', $1),
    ('Vendor Onboarding', 'Set up new vendors in procurement system', 'UiPath', 'Vendor registration forms', 'Vendor master records', 'medium', 'generated', $1),
    ('Time Entry Import', 'Import timesheet data from Excel to HR system', 'Automation Anywhere', 'Excel timesheets', 'HR system time records', 'low', 'generated', $1),
    ('Quote Generation', 'Generate sales quotes from opportunity data', 'UiPath', 'CRM opportunity records', 'PDF quote documents', 'medium', 'pending', $1),
    ('Contract Data Extract', 'Extract key terms from contract documents', 'Blue Prism', 'Contract PDF documents', 'Structured contract data', 'high', 'pending', $1),
    ('Email Response Bot', 'Auto-respond to common customer inquiries', 'UiPath', 'Customer emails', 'Email responses', 'medium', 'generated', $1),
    ('Compliance Reporting', 'Generate regulatory compliance reports', 'Automation Anywhere', 'System logs, audit data', 'Compliance report PDFs', 'high', 'pending', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed Automation Exceptions (15 items)
  await pool.query(`
    INSERT INTO automation_exceptions (name, exception_type, error_message, source_system, stack_trace, severity, impact, status, created_by) VALUES
    ('Invoice OCR Failure', 'Data Extraction', 'Unable to extract vendor name from invoice', 'Invoice Processing Bot', 'OCREngine.Extract() failed at line 245', 'medium', 'Invoice requires manual processing', 'open', $1),
    ('ERP Connection Timeout', 'System Connectivity', 'Connection to SAP timed out after 30 seconds', 'Order Entry Bot', 'SAPConnector.Connect() timeout at line 112', 'high', '50 orders pending entry', 'in_progress', $1),
    ('Data Validation Error', 'Business Rule', 'Customer credit limit exceeded for order', 'Order Processing', 'ValidationEngine.CheckCredit() failed', 'medium', 'Order held for manual review', 'resolved', $1),
    ('Email Server Unavailable', 'System Connectivity', 'SMTP server not responding', 'Report Distribution Bot', 'EmailService.Send() failed at line 89', 'high', 'Reports not delivered to stakeholders', 'open', $1),
    ('File Format Mismatch', 'Data Quality', 'Expected CSV but received XLSX file', 'Data Import Bot', 'FileParser.Parse() format exception', 'low', 'Import delayed until file converted', 'resolved', $1),
    ('Authentication Expired', 'Security', 'OAuth token expired for CRM system', 'Customer Sync Bot', 'AuthService.Authenticate() token invalid', 'high', 'Customer data sync halted', 'in_progress', $1),
    ('Duplicate Record Found', 'Data Quality', 'Vendor already exists in master data', 'Vendor Onboarding Bot', 'MasterData.Create() duplicate key', 'low', 'Vendor registration skipped', 'resolved', $1),
    ('API Rate Limit', 'System Constraint', 'API rate limit exceeded (429 error)', 'Web Scraping Bot', 'HTTPClient.Get() rate limited', 'medium', 'Data collection delayed 1 hour', 'open', $1),
    ('Missing Required Field', 'Data Quality', 'Employee ID is required but not provided', 'HR Data Sync', 'DataValidator.Validate() null field', 'medium', '15 employee records not synced', 'in_progress', $1),
    ('System Under Maintenance', 'System Availability', 'Target system unavailable for scheduled maintenance', 'Payroll Processing Bot', 'SystemStatus.Check() maintenance mode', 'high', 'Payroll processing delayed', 'resolved', $1),
    ('Currency Conversion Error', 'Business Logic', 'Exchange rate not available for ZAR', 'Invoice Processing', 'CurrencyService.Convert() rate not found', 'medium', 'Invoice amount not converted', 'open', $1),
    ('File Lock Conflict', 'Resource Contention', 'Excel file locked by another user', 'Report Generation Bot', 'FileAccess.Open() sharing violation', 'low', 'Report generation retried', 'resolved', $1),
    ('Database Deadlock', 'System Error', 'Transaction deadlock detected', 'Batch Processing Bot', 'DBTransaction.Commit() deadlock victim', 'high', 'Batch processing restarted', 'resolved', $1),
    ('Invalid Date Format', 'Data Quality', 'Date format DD/MM/YYYY expected but got MM/DD/YYYY', 'Data Entry Bot', 'DateParser.Parse() format exception', 'low', 'Records need date correction', 'open', $1),
    ('Memory Limit Exceeded', 'System Resource', 'Process exceeded 4GB memory allocation', 'Large File Processing', 'OutOfMemoryException at DataLoader.Load()', 'high', 'Processing aborted, restart required', 'in_progress', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  // Seed ROI Calculations (15 items)
  await pool.query(`
    INSERT INTO roi_calculations (name, project_description, implementation_cost, annual_savings, time_savings_hours, current_fte_cost, automation_type, payback_period, status, created_by) VALUES
    ('Invoice Processing Automation', 'Automate end-to-end invoice processing with AI-powered data extraction', 75000.00, 120000.00, 2500, 65000.00, 'RPA + AI', '8 months', 'draft', $1),
    ('Customer Onboarding Bot', 'Automate customer account setup and verification', 45000.00, 85000.00, 1800, 55000.00, 'RPA', '6 months', 'calculated', $1),
    ('HR Data Synchronization', 'Sync employee data between HR systems automatically', 25000.00, 45000.00, 1000, 50000.00, 'Integration', '7 months', 'draft', $1),
    ('Order Entry Automation', 'Automate order entry from multiple channels', 60000.00, 95000.00, 2000, 60000.00, 'RPA', '8 months', 'calculated', $1),
    ('Report Generation Suite', 'Automate recurring report creation and distribution', 35000.00, 55000.00, 1200, 55000.00, 'RPA', '8 months', 'draft', $1),
    ('Claims Processing Automation', 'Automate insurance claims intake and validation', 120000.00, 200000.00, 4000, 70000.00, 'RPA + AI', '7 months', 'calculated', $1),
    ('Vendor Management Bot', 'Automate vendor onboarding and performance tracking', 40000.00, 65000.00, 1500, 55000.00, 'RPA', '8 months', 'draft', $1),
    ('Contract Analysis Tool', 'AI-powered contract review and risk assessment', 85000.00, 140000.00, 2200, 80000.00, 'AI/ML', '7 months', 'draft', $1),
    ('Compliance Monitoring', 'Automated compliance checking and reporting', 55000.00, 90000.00, 1800, 65000.00, 'RPA + AI', '7 months', 'calculated', $1),
    ('Email Triage System', 'AI-powered email classification and routing', 30000.00, 50000.00, 1500, 50000.00, 'AI/ML', '7 months', 'draft', $1),
    ('Inventory Management', 'Automate inventory tracking and reorder processing', 50000.00, 80000.00, 1600, 55000.00, 'RPA', '8 months', 'draft', $1),
    ('Payroll Automation', 'Automate payroll processing and reconciliation', 65000.00, 110000.00, 2400, 60000.00, 'RPA', '7 months', 'calculated', $1),
    ('Customer Service Bot', 'AI chatbot for common customer inquiries', 40000.00, 75000.00, 3000, 45000.00, 'AI/ML', '6 months', 'draft', $1),
    ('Document Classification', 'AI-powered document sorting and routing', 35000.00, 60000.00, 1400, 50000.00, 'AI/ML', '7 months', 'calculated', $1),
    ('Financial Reconciliation', 'Automate bank and GL reconciliation', 70000.00, 115000.00, 2000, 70000.00, 'RPA', '7 months', 'draft', $1)
    ON CONFLICT DO NOTHING
  `, [userId]);

  console.log('All data seeded successfully!');
}

async function main() {
  try {
    console.log('Starting database setup and seeding...');
    await createTables();
    await seedData();
    console.log('Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error during setup:', error);
    process.exit(1);
  }
}

main();
