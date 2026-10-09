# Prototype the packaged sidecar

Type: prototype (HITL)
Status: open
Assignee: Eric
Blocked by: none

## Question

Does a bare Tauri 2 shell plus the frozen backend actually work on both platforms, before the spec commits to it? Build the smallest version: PyInstaller `--onedir` backend, Tauri starts it, waits for `/health` and loads `http://127.0.0.1:<port>`. Then:
- on Eric's Mac: Apple Vision OCR (`ocrmac`/pyobjc) and HEIC work inside the frozen build; cold start; installed size; the ad-hoc-signed DMG opens via "Open Anyway"
- on Simon's Windows machine: the installer, the firewall allow rule, the phone reaching the LAN address, SmartScreen
- quitting and force-killing the app leaves no backend process running

It works through the 12 risks listed in [research/02-tauri-sidecar.md](../research/02-tauri-sidecar.md).

**Mac first (2026-10-10):** not throwaway any more. The macOS half becomes the real app skeleton in `desktop/` on `plan/desktop-app`; the Windows half waits for Simon.

## Progress

- **2026-10-10 (Eric), macOS:**
  - `Tally.app` is 97 MB and the DMG 40 MB.
  - Startup to `/health` takes ~3 s (4.7 s the first time).
  - Apple Vision OCR and an iPhone HEIC both work in the frozen build.
  - Quitting or force-killing the app stops the backend (stdin EOF).
  - The data lives in `~/Library/Application Support/Tally` and the logs in `~/Library/Logs/ph.matchmo.tally`.
- **The dashboard:** a copy of `web/` in `web-desktop/` (the user's call; `web/` is unchanged) is built as a static export and served by `api/desktop.py`. Its pages use `?id=`. The path links the backend still writes (`/receipts/5`, the capture QR `/capture/5?t=…`) redirect to them, so the shared API and its tests didn't change. Clicked through in headless Chrome with the demo data: no console errors, and live updates connect.
- **Not done yet:** Gatekeeper on a clean Mac, a firewall prompt, and the LAN address changing while running. The Windows half waits for Simon.
