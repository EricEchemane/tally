# Tally for Windows

## Purpose

Tally for Windows is an installable local-first desktop app for Windows 11 x64. Windows 10 is not supported for the pilot: it is past end of support and has no test machine. It delivers the same Reviewer workflow as the macOS app: local AI setup, receipt scans, phone capture, review, approval and exports.

## Architecture

- Tauri hosts the desktop window.
- A bundled Python/FastAPI sidecar owns SQLite, images, the receipt pipeline and exports.
- The static `web-desktop` app is served by the sidecar on a localhost port.
- The sidecar also listens on the private LAN so a phone can submit receipt photos through a QR capture link.
- RapidOCR and ONNX Runtime replace Apple Vision OCR. The engine must supply line boxes so the existing row grouping, rotation retry and provider-TIN position rule remain intact.

## Installation and setup

- Ship an unsigned, per-user NSIS installer for the pilot. Onboarding explains the SmartScreen “More info” and “Run anyway” path.
- The installer asks for administrator approval to create a Windows Firewall allow rule for Private networks only. Phone capture remains unavailable on public networks. If the rule is missing (the prompt was declined, or the user is not an administrator), the QR capture screen says “Phone capture is blocked by Windows Firewall” and offers an Allow button that asks for elevation again. If the rule exists but Windows treats the current network as Public (the first test laptop's Wi-Fi was), the screen says so and explains how to set the office Wi-Fi to Private.
- Uninstall keeps the database and photos unless the Reviewer ticks “Delete the application data”. It always removes the Ollama that Tally unpacked, and never removes the downloaded model or an Ollama the Reviewer installed.
- App data lives in `%LOCALAPPDATA%\ph.matchmo.tally` (Local, not Roaming, so roaming profiles never copy an open database or the photos): one SQLite database, receipt-photo directory, setup state, backups, logs, and the Ollama that Tally unpacks (`ollama\`). The app itself installs to `%LOCALAPPDATA%\Tally`; keeping data out of the install folder lets the uninstaller's own “Delete the application data” box clear it.
- First run checks for at least 8 GB RAM and enough free disk, drive by drive: 4 GB where the model goes (Ollama's models folder, which `OLLAMA_MODELS` may move to another drive) and, when Tally must install Ollama, 2 GB more on the data folder's drive (`ollama-windows-amd64.zip` v0.40.2 is 1.37 GB and unpacks to 1.8 GB). It then collects Company name, TIN and Buyer Details Rule.
- First run warns, without blocking, when Windows is older than Windows 11 (build 22000).
- Tally detects Ollama. When it is missing, Tally downloads Ollama's standalone `ollama-windows-amd64.zip`, checks it against Ollama's published `sha256sum.txt`, unpacks it and runs `ollama serve` with no window, tray app or startup entry. An Ollama the Reviewer installed themselves is used as is. Tally then pulls `qwen3:4b` with resumable progress.
- If setup cannot download Ollama or the model, the Reviewer can finish setup and use review and exports. Scanning states “Waiting for local AI” until setup resumes.

## Runtime behaviour

- Review and exports remain usable while the receipt queue runs. Measured on an 8 GB Windows 11 laptop, CPU only: 19 s median and 31 s worst per receipt (RapidOCR 3–12 s, `qwen3:4b` 11–23 s), over the 20 fixtures.
- Scanning needs about 5 GB of free memory while the model works. On an 8 GB laptop with an editor, browsers and WSL open, Windows ran out of commit memory and both OCR and the model failed with out-of-memory errors.
- If another Ollama model already uses memory, Tally warns the Reviewer and waits. It never unloads or changes the other model.
- When RapidOCR cannot read a receipt after rotation retries, Tally retains the photo and marks the receipt Needs review. The Reviewer can correct fields or replace the photo.
- Closing the window quits Tally and stops the sidecar. Phone capture addresses refresh when the active network changes.

## Data, updates and support

- Backup and Restore operate on a single ZIP containing the database and receipt photos.
- Pilot updates are manual downloads. Before an update migrates a database, Tally creates a local backup.
- “Export diagnostics” creates a local ZIP with redacted logs and version details. It excludes the database and receipt photos; nothing is sent automatically.

## Pilot release gate

Release only after these flows succeed on Windows 11:

1. Clean install and first-run setup.
2. Phone upload over a private office network.
3. Receipt processing with RapidOCR and the local model.
4. Receipt review and Liquidation approval.
5. Liquidation summary and SLSP export.

RapidOCR passes when provider TIN, date, total and VAT are correct on at least every receipt fixture Apple Vision gets right, and rotation retry still fixes the sideways fixtures. The gate run times five receipts and records the median and worst time here.

### OCR result (2026-10-10): accepted for the pilot with known gaps

RapidOCR does **not** meet that bar. Over the 20 fixtures, through `derive` and the checks, against the macOS (Vision) extraction:

- Rotation retry is right on all 20.
- 11 receipts end the same as on macOS, and 2 end better (a false flag disappears).
- 5 carry a misread that still lands in Needs review: tilted or faded headers lose or misread the seller TIN (llaollao, Mercury 226), one total reads ₱952 as ₱992 (Goldilocks), and small VAT amounts are dropped.
- 2 were silent before the safety checks below: a "26" year read as 2608 auto-rejected a valid receipt (Mercury 458), and a torn receipt's ₱11.25 VAT read as ₱0 was accepted (Lawson).

Engine comparison on the same fixtures (key values present in the OCR text): RapidOCR 1.4 tuned (`det_score_mode="slow"`, `det_box_thresh=0.4`, no dilation) misses 6; RapidOCR 3.x with PP-OCRv5 mobile or server models misses 10; Windows.Media.Ocr misses 31 and doesn't detect a sideways receipt. The weak spot is detection of tightly packed, tilted header lines.

Decision: ship RapidOCR as tuned and add three checks that also protect macOS (no macOS fixture changes outcome): a year after the Spending Period's next year is a misread (Needs review, never Reject); a VAT-registered receipt with no VAT read goes to Needs review; and so does a receipt with no VAT where neither "VAT Reg" nor "Non-VAT" was read (Lawson lost its "VAT Reg TIN" line to OCR). Re-run with them: Mercury 458 and Lawson both land in Needs review, so no fixture is silently wrong. Improving Windows reading of tilted and torn receipts (for example straightening the photo first) is separate follow-up work.

## Required implementation work

1. Add the Windows NSIS target, installer configuration, firewall action (with the correct resource path to `tally-api.exe`), uninstall cleanup of Tally's Ollama, and SmartScreen guidance.
2. Add RapidOCR and ONNX Runtime to Windows dependencies and PyInstaller collection rules; keep `ocrmac` Darwin-only.
3. Implement Windows OCR in the real pipeline and validate it against receipt fixtures.
4. Implement Windows setup checks (including the Windows 11 warning), Ollama discovery and the standalone-zip install.
5. Fix Windows sidecar cleanup to use a valid `taskkill` invocation.
6. Move Windows app data to `%LOCALAPPDATA%\ph.matchmo.tally`, and add the capture-screen firewall check with its Allow button.
7. Replace macOS-only UI labels and log-path text with platform-appropriate wording.
8. Add the release-gate checks on a real Windows 11 machine.
