# Tauri with a Python sidecar

Type: research (AFK)
Status: resolved
Assignee:
Blocked by: none

## Question

How does a Tauri 2 app ship and run the FastAPI backend as a sidecar on macOS (Apple Silicon) and Windows x64?
- Freezing the backend: PyInstaller vs Nuitka vs alternatives; size; cold-start time; known problems with `pyobjc` (for `ocrmac`), `pillow-heif`, `uvicorn` and `openpyxl`
- Lifecycle: starting it, passing the port and the data folder, health-checking it, stopping it on quit, orphaned processes after a crash
- The window loading `http://127.0.0.1:<port>` from the sidecar rather than bundled assets: what Tauri allows (capabilities, CSP, remote URL), and WebSocket support in WKWebView and WebView2
- The sidecar listening on the LAN for phone capture: the macOS and Windows firewall prompts, and what unsigned builds show
- Unsigned pilot builds: what Gatekeeper and SmartScreen show, and how a user gets past them
- Building both platforms: does each need its own machine, or can CI (GitHub Actions) build both?

## Answer

**Full findings are in [research/02-tauri-sidecar.md](../research/02-tauri-sidecar.md)**, including 12 risks for a prototype. No real build was made; sizes and cold starts are estimates or other projects' figures. **Tauri 2 can ship the backend as a sidecar on both platforms.**
- **Freezing:** PyInstaller in one-folder mode (`--onedir`), built on each OS's own CI runner. One-file mode leaves the real server running after `kill()`, starts slower and trips antivirus. pyobjc/ocrmac and pillow-heif need extra build flags. Estimate: ~80–110 MB installed, 30–45 MB to download.
- **Lifecycle:** Rust starts the sidecar with `TALLY_DATA_DIR`. The sidecar binds `0.0.0.0` on a preferred port (with a fallback) and prints the port; Rust waits for `/health` before opening the window. Tauri doesn't kill Rust-started children, so: graceful stop then kill on quit, exit when stdin closes (covers a crash), and PID-file cleanup at the next launch.
- **Window:** loading `http://127.0.0.1:<port>` works, and so do WebSockets in WKWebView and WebView2. No Tauri capability is needed unless the page calls native APIs.
- **Firewall:** on Windows, a non-admin user's prompt silently creates a *block* rule, which breaks phone capture. The installer must add the allow rule. On macOS, simply listening raises no Local Network prompt; the firewall prompt can repeat after updates on unsigned builds.
- **Unsigned pilots:** sign ad-hoc on macOS (`signingIdentity "-"`), then System Settings → Privacy & Security → Open Anyway (Control-click → Open no longer works since Sequoia). On Windows: More info → Run anyway. Smart App Control, where it's on, blocks unsigned apps outright, so check the pilot machine first.
- **CI:** the tauri-action matrix builds macOS arm64 and Windows x64; each job freezes its own sidecar. Private-repo minutes cost 10× on macOS and 2× on Windows.
- **For the first-run wizard ticket:** Tauri's default data folder is named after the bundle id, not `Tally`; the firewall rule; the app-data path.
