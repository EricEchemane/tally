# Map: Tally as a cross-platform desktop app

Label: wayfinder:map

## Destination

Tally as an installable desktop app: first a working macOS (Apple Silicon) app built on this branch, then a `DESKTOP.md` spec for the Windows 11 x64 port. The SQLite data lives inside the app, Ollama is set up through a first-run dialog, and phone capture still works.

## Notes

- **Domain:** same as [the liquidation-review map](../liquidation-review/map.md); vocabulary in [GLOSSARY.md](../../GLOSSARY.md). The product behaviour is fixed by [SPEC.md](../../SPEC.md); this map only decides how it is packaged, installed and run.
- **Agreed while charting (2026-10-09):**
  - **Timing:** plan now, build after the demo. `main` keeps the web + server setup; this work lives on the `plan/desktop-app` branch.
  - **Mac first, and this map carries the build (2026-10-10, overrides "plan, don't do"):** the macOS app is built here on `plan/desktop-app`, ticket by ticket: the packaged-sidecar prototype becomes the real app skeleton, then the first-run wizard, then the static export. Windows tickets (the measurement and the OCR engine choice) wait for Simon's results and don't block the Mac app. `DESKTOP.md` records what was built and decided, for the Windows port.
  - **Platforms:** macOS on Apple Silicon and Windows 11 x64. Linux, Intel Macs and Windows on ARM are out.
  - **Windows 11 only for the pilot (2026-10-10):** Windows 10 is past end of support and we have no Windows 10 machine to run the release gate on. Setup warns (does not block) below Windows 11. Revisit only if a pilot user is on Windows 10.
  - **Windows build, agreed 2026-10-10:** build and install on Simon's Windows 11 laptop first and fix what breaks before adding anything. Ollama comes from the standalone `ollama-windows-amd64.zip` (checked against `sha256sum.txt`, run headless with `ollama serve`), not `OllamaSetup.exe`, which opens a tray app and adds itself to startup; this overrides "silent per-user installer". RapidOCR passes when provider TIN, date, total and VAT are right on at least the fixtures Vision gets right, and rotation retry still fixes the sideways ones. The gate run times 5 receipts (median and worst) into `DESKTOP.md`. One PR. The site's Download stays Mac-only until the Windows gate passes. On Windows everything (data, logs, the unpacked Ollama) lives in `%LOCALAPPDATA%\ph.matchmo.tally`, not Roaming `%APPDATA%`, which overrides the Data line above. (Not `%LOCALAPPDATA%\Tally`: Tauri's per-user installer puts the app there, and its "Delete the application data" box clears the bundle-id folder.) The Windows free-disk floor becomes model + unpacked Ollama + 1 GB, measured on the first build (4 GB when Ollama is already there). If the firewall rule is missing (UAC declined, not an admin), the QR capture screen says so and offers an Allow button that asks for elevation again. Uninstall keeps the data unless the Reviewer ticks "Delete the application data"; it always removes the Ollama Tally unpacked, and never touches the model or an Ollama the Reviewer installed.
  - **Who runs it:** one Reviewer's own laptop. The app still serves the phone capture page over the office Wi-Fi through the QR code.
  - **Ollama:** on first run the app detects Ollama. If it is missing, a setup dialog gets the official installer, waits for it, then pulls `qwen3:4b` with progress. Review and exports work with no model; scanning shows "waiting for setup".
  - **Backend:** the existing FastAPI backend ships as a bundled sidecar program (no Python install). No rewrite; the tests stay.
  - **Shell:** Tauri (small installer, built-in updater, sidecar support), confirmed by research; a prototype checks it on real machines.
  - **UI:** `web/` becomes a Next.js static export served by FastAPI on one port. The desktop window loads `http://127.0.0.1:<port>`; the phone uses the LAN address of the same server.
  - **Signing:** unsigned builds for the first pilots (the accountant contact); users click through the Gatekeeper and SmartScreen warnings.
  - **First-run wizard:** Ollama, then the model download with progress, then the Company (name, TIN, Buyer Details Rule) while it downloads, then a test scan.
  - **Hardware floor:** 8 GB RAM, `qwen3:4b` only. Below that, a warning: review and exports work, scanning doesn't.
  - **Data:** one SQLite file plus a photos folder in the OS app-data folder (`~/Library/Application Support/Tally`, `%APPDATA%\Tally`). Back up and Restore write and read one `.zip`.
- **Team:** Eric (macOS, backend) and Simon (Windows, `web/`). Windows measurements happen on Simon's machine.
- **Skills:** for grilling tickets, use `grilling` and `domain-modeling`.
- **Tracker:** local markdown, same layout as the liquidation-review map: tickets in `issues/`, findings in `research/`. A ticket's `Blocked by` line lists ticket numbers; the frontier is the open, unassigned tickets whose blockers are all resolved.

## Decisions so far

<!-- one line per resolved ticket -->
- [Tauri with a Python sidecar](issues/02-tauri-python-sidecar-packaging.md): Feasible on both. PyInstaller `--onedir` per OS in CI; Rust starts the sidecar, waits for `/health`, and stops it in three layers; the window loads `127.0.0.1:<port>`. The Windows installer must add a firewall allow rule. Unsigned pilots: ad-hoc signing on macOS, "Run anyway" on Windows.
- [Ollama first-run install and model pull](issues/03-ollama-first-run-install.md): Detect via `/api/version` (v0.12.5+). Download the official installer at setup (silent per-user on Windows; unzip into /Applications on macOS). Pull with streamed progress. Our settings are per request; use `keep_alive` ~30m and warn when another model is loaded. Windows on CPU is estimated at 30–90 s per receipt.
- [What breaks when web/ becomes a static export](issues/04-web-static-export.md): 21 small changes. Drop `cacheComponents`, turn the `[id]` routes into `?id=` routes, add trailing-slash config, have FastAPI serve the export with a static-files subclass. `/api` and `/ws` stay as they are.
- [Windows OCR engine options](issues/01-windows-ocr-engine-options.md): Measure RapidOCR (ONNX, models bundled, line boxes, first choice) and Windows.Media.Ocr (built in, word boxes only, needs the en-US OCR feature). PaddleOCR is dropped: too heavy and hard to package.
- [Windows pilot scope](issues/06-choose-windows-ocr-engine.md): Windows 11 x64 gets the complete macOS Reviewer flow, including local AI setup, scans, phone capture, review, approval and exports. RapidOCR ships inside the Python sidecar. The pilot installer is unsigned and per-user; SmartScreen instructions are part of onboarding. An 8 GB RAM and 4 GB free-disk floor applies. CPU scans may take 30–90 seconds, while review and exports remain available.
- [Windows installation and recovery](issues/07-first-run-wizard-and-app-lifecycle.md): The installer requests an administrator-approved firewall allow rule for phone capture. Updates are manual for unsigned pilots and create a local backup before schema migration. If local AI setup cannot download Ollama or the model, the app completes setup in review-and-exports mode and labels scanning “Waiting for local AI” until the Reviewer resumes setup.
- [Windows pilot delivery](issues/07-first-run-wizard-and-app-lifecycle.md): Ship an NSIS installer. When another Ollama model occupies memory, Tally warns and waits without changing that model. “Export diagnostics” creates a local ZIP of redacted logs and version details, excluding the database and receipt images. The release gate is a successful clean install, setup, phone upload, processed receipt, approval, and both exports on Windows 11.
- [Windows OCR result](../../DESKTOP.md): RapidOCR 1.4, tuned, ships for the pilot although it misses the "match Vision" bar (13 of 20 fixtures same or better; misreads mostly land in Needs review). Three new checks keep misreads from being silent: an impossible future year is Needs review, never Reject; a VAT-registered receipt with no VAT read is Needs review; and so is one with no VAT whose VAT status couldn't be read.
- [Windows OCR and network recovery](issues/06-choose-windows-ocr-engine.md): The firewall rule applies to Private networks only. When RapidOCR cannot read a receipt after rotation retries, Tally retains the image and sends it to review for manual correction or replacement.

## Not yet specified

- **Signing and auto-update:** an Apple Developer account and notarization, a Windows certificate (Azure Trusted Signing or a standard one), and Tauri's updater. Needed once a company pays, not for pilots.
- **Windows speed:** measured 2026-10-10 on an 8 GB Windows 11 laptop, CPU only: 19 s median, 31 s worst per receipt. Free memory, not speed, is the risk: with other apps open the model ran out of memory. Should we turn on `OLLAMA_IGPU_ENABLE` for Intel integrated GPUs, and check free memory before a scan?
- **Better Windows reading of tilted and torn receipts:** RapidOCR misses tilted header lines (seller TIN) and some small amounts; see `DESKTOP.md`, "OCR result". Straightening the photo first is the first idea to try.
- **Upgrades and schema migrations:** a new app version opening an older SQLite file, and Restore from a backup made by an older version.
- **Low-RAM machines:** a smaller model, which would need its own accuracy measurement.
- **Crash reports and logs:** where logs go and how a pilot user sends them to us without any data leaving by itself.

## Out of scope

- **Rewriting the backend** in Rust or Node: it would throw away the tested pipeline, checks and exports.
- **Electron, or bundling Node to run `next start`:** a larger app and a second runtime for no gain over a static export.
- **A shared-drive or office-server database:** SQLite on a network share risks corruption; several Reviewers on one server is a different product.
- **Linux, Intel Macs and Windows on ARM.**
- **Cloud sync:** stays on the liquidation-review map's fog; nothing here needs the network.
