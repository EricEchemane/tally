#!/usr/bin/env bash
# Run API + web together.
#   ./dev.sh             development: hot reload (next dev, uvicorn --reload)
#   MODE=demo ./dev.sh   demo day: production web build, no reloaders (much less memory on 8GB)
#   FAKE=1 ./dev.sh      skip ocrmac/Ollama and replay fixtures
set -euo pipefail
cd "$(dirname "$0")"
export TALLY_FAKE_PIPELINE="${FAKE:-0}"
IP=$(ipconfig getifaddr en0 2>/dev/null || echo localhost)
export TALLY_WEB_URL="http://${IP}:3000"   # capture QR codes point the phone here

trap 'kill 0' EXIT
if [ "${MODE:-dev}" = "demo" ]; then
  (cd web && npm run build >/dev/null && echo "web build done")
  (cd api && OLLAMA_MAX_LOADED_MODELS=1 uv run uvicorn main:app --port 8000) &
  (cd web && npx next start -H 0.0.0.0 -p 3000) &
else
  (cd api && OLLAMA_MAX_LOADED_MODELS=1 uv run uvicorn main:app --port 8000 --reload) &
  (cd web && npx next dev -H 0.0.0.0 -p 3000) &
fi
echo "Dashboard: http://localhost:3000   Phone: ${TALLY_WEB_URL}"
wait
