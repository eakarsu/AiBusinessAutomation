# Audit Apply Note — AiBusinessAutomation

Source: `_AUDIT/reports/batch_01.md` § 12.

## Audit findings vs. reality
The audit reported "0 AI endpoints" but `routes/ai.js` actually defines 14 AI endpoints (chat, analyze-document, summarize, classify-content, extract-entities, etc.) plus an SSE stream router and a process-mining/optimizer/RPA stack — substantial.

## Original audit recommendations
- 0 AI endpoints (false; project has many)
- Missing integration API (no webhooks)
- Strategic: agentic workflows, RAG, real-time anomaly detection, white-label

## Implemented in this pass (MECHANICAL)

| # | Item | File | Endpoints |
|---|------|------|-----------|
| 1 | Webhook subscription stub | `backend/src/routes/webhooks.js` (new) + `backend/src/index.js` | `GET/POST/DELETE /api/webhooks`, `POST /api/webhooks/:id/test`, `GET /api/webhooks/_/events` |

Allowed events: workflow.started/completed/failed, approval.requested/granted/rejected, document.uploaded, invoice.processed, task.assigned, compliance.alert, exception.raised. Lazy table; payload-only test (no outbound HTTP). `node --check` passes.

## Backlog (not implemented)

| Item | Tag | Why deferred |
|------|-----|---------------|
| Outbound webhook delivery (HMAC, retry) | TOO-RISKY | Background job infra |
| Multi-agent orchestration | NEEDS-PRODUCT-DECISION | Agent topology |
| RAG over playbooks | NEEDS-PRODUCT-DECISION | Vector store + corpus |
| White-label / reseller | NEEDS-PRODUCT-DECISION | Multi-tenant model |

## Apply pass 3 (frontend)

The 14 generic AI helpers in `routes/ai.js` (`/chat`, `/analyze-document`, `/analyze-contract`, `/categorize-email`, `/suggest-workflow`, `/analyze-expense`, `/generate-agenda`, `/prioritize-ticket`, `/analyze-compliance`, `/evaluate-vendor`, `/generate-report`, `/suggest-onboarding`, `/extract-data`, `/suggest-approval-chain`) had no FE entry point. The DetailPage `aiAction` mechanism wires per-record AI; these generic helpers (especially chat) needed a direct UI.

Added `AIToolboxPage` (in `frontend/src/pages/NewFeaturesPages.js`) — a tool-picker form driven by a declarative `AI_TOOLS` array that posts to each endpoint via the existing `services/api.js` axios client (Bearer token via `localStorage.getItem('token')` interceptor). 503 responses surface a "Set `OPENROUTER_API_KEY`" hint. `extract-data` transforms its comma-separated `fields` text into the array shape the express-validator expects.

Wired into `App.js`: import, `🧠 AI Toolbox` sidebar entry at `/ai-toolbox`, and a protected `<Route>`. `node --check` passed both files. No new dependencies; no `npm install`.

## Apply pass 4 (mechanical backlog)

**No new work.** Reviewed the pass-2 backlog table — every remaining item is tagged `TOO-RISKY` (outbound webhook delivery with HMAC/retry needs background-job infra) or `NEEDS-PRODUCT-DECISION` (multi-agent orchestration, RAG, white-label). No items were marked `MECHANICAL`. Per pass-4 constraints (skip credentials / product decisions / risky changes), this project is a no-op for this pass. The 14 pass-1 AI endpoints + pass-2 webhook stub + pass-3 AIToolbox page already cover the mechanical surface area.
