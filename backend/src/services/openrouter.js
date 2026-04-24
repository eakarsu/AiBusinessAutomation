const axios = require('axios');
require('dotenv').config({ path: '../../.env' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5';

const openRouterClient = axios.create({
  baseURL: OPENROUTER_BASE_URL,
  headers: {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'http://localhost:3000',
    'X-Title': 'AI Business Automation'
  }
});

const aiService = {
  async generateCompletion(prompt, systemPrompt = '', model = OPENROUTER_MODEL) {
    try {
      const response = await openRouterClient.post('/chat/completions', {
        model,
        messages: [
          { role: 'system', content: systemPrompt || 'You are a helpful business automation assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenRouter API Error:', error.response?.data || error.message);
      throw new Error('AI service unavailable');
    }
  },

  async analyzeDocument(content) {
    const prompt = `Analyze this document and provide:
1. Document type
2. Key information extracted
3. Suggested actions
4. Priority level (high/medium/low)

Document content:
${content}`;
    return this.generateCompletion(prompt, 'You are a document analysis expert.');
  },

  async analyzeContract(content) {
    const prompt = `Analyze this contract and identify:
1. Key terms and conditions
2. Important dates and deadlines
3. Financial obligations
4. Potential risks or concerns
5. Recommended actions

Contract content:
${content}`;
    return this.generateCompletion(prompt, 'You are a contract analysis expert.');
  },

  async categorizeEmail(subject, body) {
    const prompt = `Categorize this email and suggest action:
Subject: ${subject}
Body: ${body}

Provide:
1. Category (support/sales/billing/general/urgent)
2. Priority (high/medium/low)
3. Suggested response
4. Recommended department`;
    return this.generateCompletion(prompt, 'You are an email triage specialist.');
  },

  async generateWorkflowSuggestion(description) {
    const prompt = `Based on this business process description, suggest an automated workflow:
${description}

Provide:
1. Workflow steps
2. Triggers
3. Conditions
4. Actions
5. Notifications needed`;
    return this.generateCompletion(prompt, 'You are a business process automation expert.');
  },

  async analyzeExpense(description, amount, category) {
    const prompt = `Analyze this expense for compliance:
Description: ${description}
Amount: $${amount}
Category: ${category}

Provide:
1. Policy compliance check
2. Approval recommendation
3. Similar expense patterns
4. Cost optimization suggestions`;
    return this.generateCompletion(prompt, 'You are an expense management specialist.');
  },

  async generateMeetingAgenda(topic, participants, duration) {
    const prompt = `Generate a meeting agenda:
Topic: ${topic}
Participants: ${participants}
Duration: ${duration} minutes

Provide:
1. Meeting objectives
2. Agenda items with time allocation
3. Discussion points
4. Expected outcomes
5. Pre-meeting preparation tasks`;
    return this.generateCompletion(prompt, 'You are a meeting planning assistant.');
  },

  async prioritizeTicket(title, description) {
    const prompt = `Analyze and prioritize this support ticket:
Title: ${title}
Description: ${description}

Provide:
1. Priority level (P1/P2/P3/P4)
2. Category
3. Estimated resolution time
4. Suggested response
5. Escalation recommendation`;
    return this.generateCompletion(prompt, 'You are a customer support specialist.');
  },

  async analyzeCompliance(requirement, currentState) {
    const prompt = `Analyze compliance status:
Requirement: ${requirement}
Current State: ${currentState}

Provide:
1. Compliance status (compliant/non-compliant/partial)
2. Gap analysis
3. Required actions
4. Risk assessment
5. Timeline recommendation`;
    return this.generateCompletion(prompt, 'You are a compliance and risk management expert.');
  },

  async evaluateVendor(vendorName, criteria) {
    const prompt = `Evaluate this vendor:
Vendor: ${vendorName}
Evaluation Criteria: ${criteria}

Provide:
1. Overall rating recommendation
2. Strengths
3. Areas of concern
4. Negotiation points
5. Risk assessment`;
    return this.generateCompletion(prompt, 'You are a vendor management specialist.');
  },

  async generateReport(dataDescription, reportType) {
    const prompt = `Generate a ${reportType} report based on:
${dataDescription}

Provide:
1. Executive summary
2. Key findings
3. Trends and patterns
4. Recommendations
5. Action items`;
    return this.generateCompletion(prompt, 'You are a business analyst and report specialist.');
  },

  async suggestOnboardingTasks(role, department) {
    const prompt = `Suggest onboarding tasks for:
Role: ${role}
Department: ${department}

Provide:
1. Day 1 tasks
2. Week 1 tasks
3. Month 1 milestones
4. Required training
5. Key contacts to meet`;
    return this.generateCompletion(prompt, 'You are an HR onboarding specialist.');
  },

  async extractDataFromText(text, fields) {
    const prompt = `Extract the following fields from this text:
Fields needed: ${fields.join(', ')}

Text:
${text}

Return the extracted data in a structured format.`;
    return this.generateCompletion(prompt, 'You are a data extraction specialist.');
  },

  async analyzeInvoice(invoiceData) {
    const prompt = `Analyze this invoice:
${JSON.stringify(invoiceData, null, 2)}

Provide:
1. Validation status
2. Payment recommendation
3. Budget impact
4. Anomaly detection
5. Approval recommendation`;
    return this.generateCompletion(prompt, 'You are an accounts payable specialist.');
  },

  async suggestApprovalChain(requestType, amount) {
    const prompt = `Suggest approval chain for:
Request Type: ${requestType}
Amount: $${amount}

Provide:
1. Required approvers
2. Approval sequence
3. Escalation path
4. SLA recommendations
5. Alternative approvers`;
    return this.generateCompletion(prompt, 'You are a business process and approval workflow expert.');
  },

  // ============================================
  // NEW OPERATIONS FEATURES - AI FUNCTIONS
  // ============================================

  async analyzeProcess(name, description, eventLog) {
    const prompt = `Analyze this business process for optimization opportunities:

Process Name: ${name}
Description: ${description}
Event Log/Activities: ${eventLog || 'Not provided'}

Provide a comprehensive process mining analysis including:

## Process Overview
- Process flow summary
- Key activities identified
- Process variants detected

## Performance Metrics
- Estimated cycle time
- Bottleneck identification
- Wait time analysis
- Throughput assessment

## Improvement Opportunities
- Automation candidates
- Redundant steps to eliminate
- Parallel processing opportunities
- Resource optimization suggestions

## Risk Analysis
- Process vulnerabilities
- Compliance gaps
- Quality control points

## Recommendations
- Quick wins (immediate improvements)
- Medium-term optimizations
- Long-term transformation opportunities
- Expected benefits and ROI potential`;
    return this.generateCompletion(prompt, 'You are a process mining and business process optimization expert with deep knowledge of BPMN, Six Sigma, and Lean methodologies.');
  },

  async optimizeWorkflow(name, description, currentSteps, bottlenecks, goals) {
    const prompt = `Optimize this workflow for maximum efficiency:

Workflow Name: ${name}
Description: ${description}
Current Steps: ${currentSteps || 'Not specified'}
Known Bottlenecks: ${bottlenecks || 'Not identified'}
Optimization Goals: ${goals || 'General improvement'}

Provide comprehensive workflow optimization recommendations:

## Current State Analysis
- Workflow assessment summary
- Identified inefficiencies
- Resource utilization review

## Optimized Workflow Design
- Recommended new workflow steps
- Step-by-step improvements
- Parallel processing opportunities
- Automation integration points

## Bottleneck Resolution
- Specific solutions for each bottleneck
- Priority order for addressing issues
- Expected improvement percentages

## Implementation Plan
- Phase 1: Quick wins (1-2 weeks)
- Phase 2: Process changes (1 month)
- Phase 3: Full optimization (2-3 months)

## Technology Recommendations
- Automation tools to implement
- Integration requirements
- Monitoring and analytics setup

## Success Metrics
- KPIs to track
- Baseline vs. target comparisons
- ROI projections`;
    return this.generateCompletion(prompt, 'You are a workflow optimization specialist with expertise in business process reengineering, automation, and lean principles.');
  },

  async generateRPAScript(name, taskDescription, platform, inputData, outputFormat) {
    const prompt = `Generate an RPA automation script for:

Task Name: ${name}
Task Description: ${taskDescription}
Target Platform: ${platform || 'UiPath'}
Input Data: ${inputData || 'User specified'}
Output Format: ${outputFormat || 'Standard output'}

Provide a comprehensive RPA solution:

## Automation Overview
- Use case summary
- Automation type (attended/unattended)
- Estimated time savings

## Process Flow
- Step-by-step automation workflow
- Decision points and conditions
- Exception handling triggers

## Script Components

### Main Process
\`\`\`
[Provide pseudo-code or structured steps for the main automation process]
\`\`\`

### Input Handling
- Data sources
- Validation rules
- Pre-processing requirements

### Output Generation
- Output format and location
- Post-processing steps
- Notification triggers

## Error Handling
- Common exceptions to handle
- Retry logic
- Fallback procedures
- Alert notifications

## Configuration
- Environment variables
- Credentials management
- Logging requirements

## Testing Checklist
- Unit tests to perform
- Integration test scenarios
- UAT considerations

## Deployment Guide
- Prerequisites
- Installation steps
- Scheduling recommendations
- Maintenance requirements`;
    return this.generateCompletion(prompt, 'You are an RPA developer expert with deep knowledge of UiPath, Blue Prism, Automation Anywhere, and Python automation frameworks.');
  },

  async resolveException(name, exceptionType, errorMessage, sourceSystem, stackTrace) {
    const prompt = `Analyze and resolve this automation exception:

Exception Name: ${name}
Exception Type: ${exceptionType}
Error Message: ${errorMessage}
Source System: ${sourceSystem || 'Unknown'}
Stack Trace: ${stackTrace || 'Not available'}

Provide a comprehensive resolution analysis:

## Exception Analysis
- Root cause identification
- Impact assessment
- Affected systems/processes

## Immediate Resolution
- Step-by-step fix instructions
- Required actions to resolve
- Rollback procedures if needed

## Prevention Measures
- Code/configuration changes
- Validation rules to add
- Monitoring improvements

## Recovery Plan
- Data recovery steps (if applicable)
- Process restart procedures
- Verification checklist

## Long-term Recommendations
- Architecture improvements
- Better error handling patterns
- Monitoring and alerting enhancements

## Documentation
- Incident summary
- Resolution timeline
- Lessons learned
- Knowledge base update suggestions`;
    return this.generateCompletion(prompt, 'You are an automation support engineer and troubleshooting expert with experience in enterprise systems, integration patterns, and error handling best practices.');
  },

  async calculateROI(name, description, implementationCost, annualSavings, timeSavingsHours, fteCost, automationType) {
    const prompt = `Calculate and analyze ROI for this automation project:

Project Name: ${name}
Description: ${description}
Implementation Cost: $${implementationCost || 0}
Expected Annual Savings: $${annualSavings || 0}
Time Savings (hours/year): ${timeSavingsHours || 0}
Current FTE Cost: $${fteCost || 0}
Automation Type: ${automationType || 'General'}

Provide a comprehensive ROI analysis:

## Executive Summary
- Project viability assessment
- Overall recommendation
- Key financial highlights

## Cost Analysis
### Implementation Costs
- Software/licensing
- Development effort
- Training
- Infrastructure

### Ongoing Costs
- Maintenance (estimated annual)
- Support requirements
- License renewals

## Benefit Analysis
### Direct Savings
- Labor cost reduction
- Error reduction value
- Processing time improvements

### Indirect Benefits
- Employee satisfaction
- Customer experience improvement
- Compliance improvement
- Scalability benefits

## ROI Calculations
- **Simple ROI**: (Annual Benefits - Annual Costs) / Total Investment
- **Payback Period**: Time to recover investment
- **NPV (3-year)**: Net present value projection
- **IRR**: Internal rate of return estimate

## Risk Assessment
- Implementation risks
- Adoption risks
- Technology risks
- Mitigation strategies

## Sensitivity Analysis
- Best case scenario
- Worst case scenario
- Most likely scenario

## Recommendation
- Go/No-go decision
- Implementation priority
- Success criteria
- Key milestones`;
    return this.generateCompletion(prompt, 'You are a financial analyst and automation ROI specialist with expertise in business case development, cost-benefit analysis, and enterprise automation valuations.');
  }
};

module.exports = aiService;
