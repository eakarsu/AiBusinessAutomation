#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$ROOT/.env" ]] || { echo "Missing .env; copy .env.example." >&2; exit 1; }
frontend_port="${FRONTEND_PORT:-3000}"
export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-http://127.0.0.1:$frontend_port}"
if [[ "${NODE_ENV:-}" == "test" && -z "${AUTOMATION_WEBHOOK_SECRET:-}" ]]; then
  export AUTOMATION_WEBHOOK_SECRET="runtime-test-only-automation-webhook-secret"
fi
case "${1:-backend}" in backend) cd "$ROOT/backend"; exec npm start;; frontend) cd "$ROOT/frontend"; exec npm start;; *) echo "Usage: $0 [backend|frontend]" >&2; exit 64;; esac
