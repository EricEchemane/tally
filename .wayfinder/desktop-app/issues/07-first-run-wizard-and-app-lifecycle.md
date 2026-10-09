# First-run wizard and app lifecycle

Type: grilling (HITL)
Status: open
Assignee: Eric
Blocked by: 02, 03, 08

## Question

Screen by screen, what does the first-run wizard show and do (Ollama check, install, model pull with progress, Company details, test scan, the firewall prompt), and what happens on every failure path (no internet during setup, not enough disk, the user cancels, Ollama won't start)? After setup: what happens when the window closes, which port the app uses, and what the Reviewer sees when Ollama is not running.

Also settle, from the research: the app-data folder name (Tauri defaults to the bundle id, not `Tally`), adding the Windows firewall allow rule in the installer, and what the app does when another Ollama model is loaded.

## Progress

**2026-10-10 (Eric): built for macOS.** Asked to "build everything that's needed when users start the app or installer", so these defaults were taken while building. Each is open to revisit:
- **A new install starts empty** (`TALLY_SEED=empty`: a blank Company, no demo data). The wizard is at `/setup/` in `web-desktop/` and the backend is `api/desktop_setup.py`, mounted only by `desktop.py`. The dashboard redirects to the wizard until it is done (`setup.json` in the data folder).
- **Steps:**
  1. This computer: RAM ≥ 8 GB, ≥ 4 GB free, macOS ≥ 14.
  2. Your Company: name, TIN (9–14 digits), Buyer Details Rule.
  3. Local AI: Ollama, then the model.
  4. Done.
- **Ollama on macOS:** if it's missing, download `Ollama-darwin.zip` from the latest GitHub release, check it against `sha256sum.txt`, unzip with `ditto` into `/Applications` (falling back to `~/Applications`), and `open -a Ollama --args hidden`. If it's stopped, start the app, or run `ollama serve` for Homebrew. If it's older than 0.12.5, offer a reinstall.
- **Model:** the pull starts on its own once Ollama runs, with progress and pause/resume. The Reviewer may finish setup while it downloads.
- **Receipts wait for the model instead of failing** (`runner._model_ready`, with a test). A banner on the dashboard says so and links back to setup. Questions still answer at once.
- **The phone address follows network changes:** `config.WEB_URL` is refreshed every 5 s.
- **DMG:** a drag-to-Applications window that also shows the steps for opening an unsigned app the first time.
- **Closing the window quits Tally,** which stops the backend. A tray mode is not built.
- **Not tested:** a real Ollama install from scratch (this Mac has Homebrew Ollama), and Gatekeeper with a DMG downloaded on another Mac.
