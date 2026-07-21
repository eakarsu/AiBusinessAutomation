# Authoritative automation runbook

Install from lockfiles, copy `.env.example`, then run `npm run migrate` in `backend/` with a migration role. `./start.sh backend` performs no setup or cleanup and fails if `automation_runs` is absent. The launcher derives a loopback-only CORS origin from `FRONTEND_PORT` when none is supplied. `AUTOMATION_WEBHOOK_SECRET` remains mandatory outside `NODE_ENV=test`; the disposable test runtime receives a test-only value when one is absent.

Use `/api/authoritative/automation`. Tenant identity is token-bound. Every write step needs compensation; consequential workflows require independent approval. Typed connector calls are durable, payload-bound, retried with backoff, and dead-lettered. Signed inbound webhooks are deduplicated.

Monitor queue age, exception and compensation rates, dead letters, approval age, evaluation regressions, and audit availability. Correct the connector or workflow definition before replay; retain idempotency keys and never bypass compensation evidence. Legacy, generated, direct-AI, and unscoped routes are quarantined.

Normal connector work can run only while a workflow is `executing`; compensation operations use an explicit `compensate:` operation while it is `compensating`, and recovery requires the matching confirmed provider receipt. A requester or administrator may revoke an applicable consent, which cancels the run and dead-letters pending work. Administrators apply the approved retention schedule with the bounded, tenant-scoped `POST /api/authoritative/automation/retention/purge` operation.
