#!/usr/bin/env bash
# Demo pre-flight (SPEC §10). Run with ./dev.sh already running:
#   resets the demo data, warms the model, checks health and memory, prints the URLs.
set -euo pipefail
API=http://127.0.0.1:8000/api
curl -sf "$API/health" >/dev/null || { echo "API not running: start ./dev.sh first"; exit 1; }

echo "Resetting demo data…"
curl -sf -X POST "$API/admin/demo-reset" >/dev/null
echo "Warming the model (first call can take ~20 s)…"
curl -sf -X POST "$API/admin/warmup" | python3 -c "import json,sys; d=json.load(sys.stdin); print('  warmed' if d.get('warmed') else '  NOT warmed: ' + str(d.get('reason')))"
curl -sf "$API/health" | python3 -c "
import json, sys; h = json.load(sys.stdin)
ok = h['ollama'] in ('up', 'fake') and h['model_loaded'] and h['queue']['length'] == 0
print(('  ✅' if ok else '  ⚠️ ') + f\" ollama={h['ollama']} model={h['model']} loaded={h['model_loaded']} queue={h['queue']['length']}\")"
echo "  swap in use: $(sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9.]+M).*/\1/') (close Chrome tabs and other apps if high)"

IP=$(ipconfig getifaddr en0 2>/dev/null || echo localhost)
echo
echo "Dashboard: http://localhost:3000"
echo "Phone:     http://${IP}:3000  (same Wi-Fi or hotspot; scan the QR on the Liquidation screen)"
