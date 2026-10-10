# Tally

> Every receipt checked against BIR rules, on your own laptop.

Local-first liquidation review for Philippine companies: phone photos of receipts are read with on-device OCR (Apple Vision on Mac, RapidOCR on Windows) and a local LLM (qwen3:4b via Ollama), checked by code against BIR rules, and reviewed on a dashboard, with no cloud.

**Build spec:** [SPEC.md](SPEC.md) · **Windows app:** [DESKTOP.md](DESKTOP.md) · **Vocabulary:** [GLOSSARY.md](GLOSSARY.md)

## Install

Download the installer for your computer from the [latest release](https://github.com/EricEchemane/tally/releases/latest). These are pilot builds: they are not yet notarized (Mac) or signed (Windows), so the first launch takes one extra step.

### Mac

**Requirements**

- Apple Silicon (M1 or newer), macOS 14 Sonoma or newer
- 8 GB of memory
- About 4 GB of free disk space, and an internet connection once for the local AI (Ollama and qwen3:4b, set up from inside Tally)

**Steps**

1. Download [`Tally-mac-arm64.dmg`](https://github.com/EricEchemane/tally/releases/download/desktop-v0.1.0/Tally-mac-arm64.dmg), open it and drag **Tally** into **Applications**.
2. Open Tally. macOS says it can't check the app: click **Done**.
3. Go to **System Settings → Privacy & Security**, scroll down and click **Open Anyway** next to Tally, then enter your password.
4. Tally opens its setup: your Company's details, then the local AI download. After that, everything stays on your Mac.

### Windows

**Requirements**

- Windows 11, 64-bit (x64). Windows 10 is not supported.
- 8 GB of memory, with other apps closed while receipts are read (the local AI needs about 5 GB free)
- About 6 GB of free disk space, and an internet connection once for the local AI (Ollama and qwen3:4b, set up from inside Tally)

**Steps**

1. Download and run [`Tally-windows-x64-setup.exe`](https://github.com/EricEchemane/tally/releases/download/desktop-v0.1.0/Tally-windows-x64-setup.exe). If SmartScreen says it protected your PC, click **More info**, then **Run anyway**.
2. When Windows asks, click **Yes** to let Tally through Windows Firewall. Phones use this to send receipt photos over your office Wi-Fi (Private networks only).
3. Tally opens its setup: your Company's details, then the local AI download. After that, everything stays on your computer.
4. For phone capture, set your office Wi-Fi to **Private** (Settings → Network & internet → Wi-Fi → your network).

Tally installs per user to `%LOCALAPPDATA%\Tally` and keeps its data in `%LOCALAPPDATA%\ph.matchmo.tally`. Uninstalling keeps your data unless you tick **Delete the application data**.

**Verify a download (optional):** compare against the SHA-256 checksums in the release notes, with `shasum -a 256 Tally-mac-arm64.dmg` on Mac or `Get-FileHash .\Tally-windows-x64-setup.exe` in PowerShell.

## Technical disclosure

What the desktop app does on your computer and network, so you can judge it before installing.

- **Where receipts are processed:** on your computer only. OCR runs on-device (Apple Vision on Mac; RapidOCR with ONNX Runtime on Windows), then the qwen3:4b model reads the fields through Ollama at `127.0.0.1:11434`. BIR checks are plain code, not the model. No receipt, photo or figure is sent to a cloud service.
- **Internet use:** only during setup. If Ollama is missing, Tally downloads it from Ollama's GitHub releases and checks it against Ollama's published SHA-256 checksums. On Mac it installs `Ollama.app` into `/Applications` (or `~/Applications`); on Windows it unpacks a private copy into Tally's data folder and runs it with no window or startup entry. Ollama then pulls qwen3:4b (about 2.5 GB) from the Ollama registry. An Ollama you installed yourself is used as is. After setup, Tally works offline.
- **No telemetry:** Tally has no analytics, crash reporting or update check. **Export diagnostics** (Settings) writes a local ZIP of redacted logs and version details, without the database or photos; nothing is sent automatically.
- **Local network:** the app's backend listens on port 8765 (or any free port if that one is taken) so a phone on the same Wi-Fi can open the QR capture page. From other devices it serves only that page and photo uploads carrying the Liquidation's capture token; everything else is refused. It also rejects requests from other websites open in your browser. On Windows, the installer adds a firewall rule that allows this on **Private** networks only.
- **Data stored:** one SQLite database, the receipt photos, setup state, backups and logs, in `~/Library/Application Support/Tally` (Mac) or `%LOCALAPPDATA%\ph.matchmo.tally` (Windows). Data is not encrypted by Tally; it relies on your computer's disk encryption (FileVault or BitLocker) and account login. Backup and Restore use a single ZIP of the database and photos.
- **Accuracy:** OCR and the model can misread receipts, especially faded, torn or tilted ones; Windows OCR is weaker than Mac's (see [DESKTOP.md](DESKTOP.md#ocr-result-2026-10-10-accepted-for-the-pilot-with-known-gaps)). Unclear readings go to **Needs review** rather than being approved, but a Reviewer remains responsible for each decision. Tally is a review aid, not tax or legal advice.
- **Builds:** pilot builds are unsigned on Windows and ad-hoc signed, not notarized, on Mac. Verify the SHA-256 checksums in the release notes, or build from this source.
- **Performance:** scanning needs about 5 GB of free memory while the model works. On an 8 GB Windows 11 laptop with CPU only, a receipt takes about 19 s (31 s at worst).

## Run it from source

**macOS (full pipeline):**

```sh
./setup.sh        # once: uv, node, ollama, qwen3:4b, deps
./dev.sh          # API :8000 (localhost only) + web :3000 (LAN), hot reload
MODE=demo ./dev.sh   # demo day: production web build, no reloaders, no page compiles on stage
./demo.sh         # with dev.sh running: reset demo data, warm the model, check health and swap
```

Open http://localhost:3000. The phone opens the QR code on a Liquidation (same Wi-Fi or hotspot).

**Windows (fake pipeline: no OCR or Ollama needed; see SPEC §2):**

```powershell
cd api; uv sync; $env:TALLY_FAKE_PIPELINE="1"; uv run uvicorn main:app --port 8000 --reload
cd web; npm install; npm run dev
```

To run against Eric's Mac instead (same room), set `API_URL=http://<mac-ip>:8000` for `web` and start the Mac API with `--host 0.0.0.0` (development only).

**Desktop app (`desktop/`, Tauri):** bundles `web-desktop/` and a PyInstaller build of the API as a sidecar. Needs Rust (`rustup`) on top of the tools above.

```sh
cd desktop && npm install
npm run build     # web-desktop export + sidecar + Tauri bundle: .dmg on Mac, NSIS setup .exe on Windows
```

**Marketing site (`site/`, any OS):** the public Tally PH site. It needs no API or model.

```sh
cd site && npm install && npm run dev   # http://localhost:3001
```

## Test

```sh
cd api && uv run pytest
cd web && npx tsc --noEmit && npm run lint
cd site && npx tsc --noEmit && npm run lint
node design/sync-tokens.mjs --check   # each app's tokens.css matches design/tokens.css
```

## Design tokens

The calm-ledger colours, shadows and motion live in `design/tokens.css`, shared by the app (`web/`) and the marketing site (`site/`). Edit that file, then run `node design/sync-tokens.mjs` to copy it into each app's `src/app/tokens.css` (Turbopack won't import CSS from outside an app's folder). Fonts are set per app in its `globals.css`.

## Layout and ownership (SPEC §9)

| Path | Owner |
|---|---|
| `api/pipeline/`, `api/llm/`, `api/checks/`, `api/routes/`, `api/db/` (schema) | Eric |
| `web/`, `site/`, `design/`, `api/exports/`, `api/questions/templates/` | Simon |

An empty database starts with the demo data (`api/db/demo.py`, SPEC §3): Bayanihan Demo Corp, three Cash Advances and 11 processed receipts. Before a demo or rehearsal, run `./demo.sh` with `./dev.sh` running: it resets the data, warms the model and prints the phone URL. Deleting `api/data/` also gives a fresh start.
