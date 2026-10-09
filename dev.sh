#!/usr/bin/env bash
# Run API + web together. FAKE=1 ./dev.sh skips ocrmac/Ollama (fixtures instead).
set -euo pipefail
cd "$(dirname "$0")"
export TALLY_FAKE_PIPELINE="${FAKE:-0}"
IP=$(ipconfig getifaddr en0 2>/dev/null || echo localhost)
export TALLY_WEB_URL="http://${IP}:3000"   # capture QR codes point the phone here

trap 'kill 0' EXIT
(cd api && OLLAMA_MAX_LOADED_MODELS=1 uv run uvicorn main:app --port 8000 --reload) &
(cd web && npx next dev -H 0.0.0.0 -p 3000) &
echo "Dashboard: http://localhost:3000   Phone: ${TALLY_WEB_URL}"
wait
