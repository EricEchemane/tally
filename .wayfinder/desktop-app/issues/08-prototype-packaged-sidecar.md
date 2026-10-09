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
