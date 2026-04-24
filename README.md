# AI Business Automation Platform

A comprehensive business automation platform with AI-powered features using OpenRouter.

## Features

The platform includes 15 fully functional modules:

1. **Workflow Engine** - Create and manage automated business workflows
2. **Document Routing** - Smart document classification and routing
3. **Approval Chains** - Multi-level approval management
4. **Task Automation** - Scheduled and triggered automation tasks
5. **Email Processing** - AI-powered email categorization
6. **Invoice Processing** - Automated invoice handling and approval
7. **Contract Analysis** - AI contract review and risk analysis
8. **Support Tickets** - Customer support ticket management
9. **HR Onboarding** - Employee onboarding workflow automation
10. **Expense Reports** - Expense submission and approval
11. **Meeting Scheduler** - AI-generated meeting agendas
12. **Report Generation** - Automated business report creation
13. **Data Entry Automation** - AI-powered data extraction
14. **Compliance Monitoring** - Regulatory compliance tracking
15. **Vendor Management** - Vendor evaluation and management

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: React 18
- **Database**: PostgreSQL
- **AI**: OpenRouter API

## Prerequisites

- Node.js 18+
- PostgreSQL 12+
- OpenRouter API Key

## Quick Start

1. **Configure Environment**

   Edit the `.env` file in the root directory and add your OpenRouter API key:

   ```
   OPENROUTER_API_KEY=your-openrouter-api-key-here
   ```

2. **Start the Application**

   ```bash
   ./start.sh
   ```

   This will:
   - Clean up any ports in use (3000, 5000)
   - Setup the PostgreSQL database
   - Install all dependencies
   - Seed the database with 15 items per feature
   - Start the backend server
   - Start the frontend server

3. **Access the Application**

   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## Login Credentials

Use the "Auto-fill Demo Credentials" button on the login page, or enter:

- **Email**: admin@company.com
- **Password**: admin123

## Project Structure

```
AiBusinessAutomation/
├── .env                    # Environment configuration
├── start.sh               # Startup script
├── backend/
│   ├── package.json
│   └── src/
│       ├── index.js       # Express server
│       ├── seed.js        # Database seeding
│       ├── config/
│       │   └── database.js
│       ├── middleware/
│       │   └── auth.js    # JWT authentication
│       ├── routes/        # API routes (15 modules)
│       └── services/
│           └── openrouter.js  # AI service
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── index.css
        ├── App.js         # Main React application
        └── services/
            └── api.js     # API client
```

## API Endpoints

Each module has full CRUD operations plus AI features:

| Module | Endpoints |
|--------|-----------|
| Auth | POST /api/auth/login, GET /api/auth/me |
| Workflows | GET, POST, PUT, DELETE /api/workflows |
| Documents | + POST /:id/analyze, POST /:id/route |
| Approvals | + POST /:id/approve, POST /:id/reject |
| Tasks | + POST /:id/execute |
| Emails | + POST /:id/categorize |
| Invoices | + POST /:id/approve, POST /:id/analyze |
| Contracts | + POST /:id/analyze |
| Tickets | + POST /:id/close, POST /:id/prioritize |
| Onboarding | + POST /:id/suggest-tasks |
| Expenses | + POST /:id/approve, POST /:id/analyze |
| Meetings | + POST /:id/generate-agenda |
| Reports | + POST /:id/generate |
| Data Entry | + POST /:id/extract |
| Compliance | + POST /:id/analyze |
| Vendors | + POST /:id/evaluate |

## AI Features

All AI features are powered by OpenRouter and include:

- Document analysis and classification
- Contract risk assessment
- Email categorization and response suggestions
- Expense compliance analysis
- Meeting agenda generation
- Ticket prioritization
- Compliance gap analysis
- Vendor evaluation
- Data extraction from unstructured text
- Report generation

## Stopping the Application

Press `Ctrl+C` in the terminal to stop all services.

## Manual Start (Alternative)

If you prefer to start services manually:

```bash
# Terminal 1 - Backend
cd backend
npm install
npm start

# Terminal 2 - Frontend
cd frontend
npm install
npm start

# Seed Database (run once)
cd backend
node src/seed.js
```

## License

MIT
