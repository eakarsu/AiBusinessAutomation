#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[[ -f "$ROOT/.env" ]] || { echo "Missing .env; copy .env.example." >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "$ROOT/.env"
set +a
frontend_port="${FRONTEND_PORT:-3000}"
export ALLOWED_ORIGINS="${ALLOWED_ORIGINS:-http://127.0.0.1:$frontend_port}"
if [[ "${NODE_ENV:-}" == "test" && -z "${AUTOMATION_WEBHOOK_SECRET:-}" ]]; then
  export AUTOMATION_WEBHOOK_SECRET="runtime-test-only-automation-webhook-secret"
fi
case "${1:-all}" in
  all)
    "$ROOT/start.sh" backend & backend_pid=$!
    "$ROOT/start.sh" frontend & frontend_pid=$!
    cleanup(){ trap - EXIT INT TERM; kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; wait "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
    trap cleanup EXIT INT TERM
    wait "$backend_pid" "$frontend_pid"
    ;;
  backend) cd "$ROOT/backend"; exec npm start;;
  frontend) cd "$ROOT/frontend"; exec env HOST="${FRONTEND_HOST:-127.0.0.1}" PORT="${FRONTEND_PORT:-3000}" REACT_APP_API_URL="${REACT_APP_API_URL:-http://127.0.0.1:${BACKEND_PORT:-5001}/api}" BROWSER=none npm start;;
  *) echo "Usage: $0 [all|backend|frontend]" >&2; exit 64;;
esac
