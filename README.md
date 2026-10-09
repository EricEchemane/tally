# Tally

> Every receipt checked against BIR rules, on your own laptop.

Local-first liquidation review for Philippine companies: phone photos of receipts are read with Apple Vision OCR and a local LLM (qwen3:4b via Ollama), checked by code against BIR rules, and reviewed on a dashboard, with no cloud.

**Build spec:** [SPEC.md](SPEC.md) · **Vocabulary:** [GLOSSARY.md](GLOSSARY.md)

## Run it

**macOS (full pipeline):**

```sh
./setup.sh        # once: uv, node, ollama, qwen3:4b, deps
./dev.sh          # API :8000 (localhost only) + web :3000 (LAN), hot reload
MODE=demo ./dev.sh   # demo day: production web build, no reloaders, no page compiles on stage
./demo.sh         # with dev.sh running: reset demo data, warm the model, check health and swap
```

Open http://localhost:3000. The phone opens the QR code on a Liquidation (same Wi-Fi or hotspot).

**Windows (fake pipeline: no ocrmac or Ollama; see SPEC §2):**

```powershell
cd api; uv sync; $env:TALLY_FAKE_PIPELINE="1"; uv run uvicorn main:app --port 8000 --reload
cd web; npm install; npm run dev
```

To run against Eric's Mac instead (same room), set `API_URL=http://<mac-ip>:8000` for `web` and start the Mac API with `--host 0.0.0.0` (development only).

## Test

```sh
cd api && uv run pytest
cd web && npx tsc --noEmit && npm run lint
node design/sync-tokens.mjs --check   # each app's tokens.css matches design/tokens.css
```

## Design tokens

The calm-ledger colours, shadows and motion live in `design/tokens.css`, shared by the app (`web/`) and the marketing site (`site/`). Edit that file, then run `node design/sync-tokens.mjs` to copy it into each app's `src/app/tokens.css` (Turbopack won't import CSS from outside an app's folder). Fonts are set per app in its `globals.css`.

## Layout and ownership (SPEC §9)

| Path | Owner |
|---|---|
| `api/pipeline/`, `api/llm/`, `api/checks/`, `api/routes/`, `api/db/` (schema) | Eric |
| `web/`, `api/exports/`, `api/questions/templates/` | Simon |

An empty database starts with the demo data (`api/db/demo.py`, SPEC §3): Bayanihan Demo Corp, three Cash Advances and 11 processed receipts. Before a demo or rehearsal, run `./demo.sh` with `./dev.sh` running: it resets the data, warms the model and prints the phone URL. Deleting `api/data/` also gives a fresh start.
