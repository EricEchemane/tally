# Choose the Windows OCR engine

Type: grilling (HITL)
Status: resolved
Assignee:
Blocked by: 05

## Question

Given the Windows measurements, which OCR engine does Tally use on Windows? Does the pipeline need changes for it (row grouping, rotation, the provider-TIN position rule), and is Windows extraction speed acceptable, or does the queue or the model change?

## Answer

**2026-10-10:** Use RapidOCR bundled with the Windows Python sidecar. It must preserve line bounding boxes so the existing row grouping, rotation retry and provider-TIN position rule can be retained. Windows 10/11 x64 reaches macOS feature parity. The supported hardware floor is 8 GB RAM and 4 GB free disk. CPU scans taking 30–90 seconds are acceptable when the queue communicates progress and review and exports remain usable. The pilot uses an unsigned per-user installer, with SmartScreen instructions in onboarding.

The installer opens the firewall only for Private networks. If RapidOCR remains unable to read a receipt after automatic rotation retries, Tally preserves the image and marks it Needs review; the Reviewer may correct its fields or replace the photo.
