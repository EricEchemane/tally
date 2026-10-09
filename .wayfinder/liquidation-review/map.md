# Map: Local AI Liquidation Review

Label: wayfinder:map

## Destination

A buildable spec for a local-first liquidation review app, with every decision below locked: the extraction schema, the checks, the questions, the API contract and the demo script. It must be ready for two developers to build in a 20-hour remote hackathon (theme: "Local AI", which must stay useful when the cloud disappears).

## Notes

- **Destination reached (2026-10-09):** all decision tickets are resolved and consolidated into [SPEC.md](../../SPEC.md). The remaining fog below is optional or stretch work.

- **Domain:** Philippine company finance. A **Reviewer** checks an **Employee's** **Liquidation** of a **Cash Advance**: receipts are scanned, **Checks** raise **Findings**, and the output is valid spend, **Disallowed Amount** and amount to return. Vocabulary lives in [GLOSSARY.md](../../GLOSSARY.md); use it.
- **Concept agreed while charting:**
  - The Reviewer opens a Cash Advance and captures receipts with the phone camera.
  - The Mac runs OCR, extraction and the checks fully offline.
  - The dashboard fills in live.
  - **MVP checks:**
    1. It's an Invoice, not an Official Receipt, and has no "NOT VALID FOR CLAIM OF INPUT TAX" stamp.
    2. Seller TIN and branch code are present and correctly formatted.
    3. For ₱1,000 or more, the buyer name and TIN match the Company.
    4. The VAT arithmetic adds up.
    5. It isn't a duplicate.
    6. The date falls inside the Cash Advance period.
  - **Stretch:** a legibility warning (check 7) and Company policy rules (check 8).
  - **Outputs:** a Liquidation summary (Excel/PDF) and an SLSP-ready purchases CSV.
  - **Second feature:** natural-language questions over the data, backed by canned queries. Voice only if time allows.
  - **Why local:** Employee and Company tax data stay in the office (Data Privacy Act), checking a whole pile costs nothing, and it works offline.
- **Stack (decided):**
  - **Backend:** Python FastAPI, `ocrmac` (Apple Vision OCR), Ollama with Qwen3 4B (one model resident, JSON-Schema `format`), SQLite and pytest. The backend owns all logic and tests.
  - **Frontend:** Next.js, react-query and WebSockets. It's a thin client the teammate polishes after features are done.
  - **Phone:** captures over the LAN or a hotspot using `<input capture>`. No inference runs on the phone.
- **Team and constraints:**
  - 2 developers. The user builds the fundamentals; the teammate does UI/UX through agents later and must not break the backend tests.
  - Hardware: M1 MacBook Pro with 8GB RAM, plus a phone.
  - 20 hours, fully remote. The demo is live and recorded, with a public repo and a LinkedIn video.
- **Demo:** the live part shows receipts filling the dashboard; the pre-recorded part shows it working with the internet cut, with a network monitor showing zero egress.
- **Research basis:**
  - Model and hardware research: OCR first (ocrmac), then a 3–4B text LLM; the VLM is the fallback.
  - BIR research: EOPT Act / RR 7-2024 invoice rules; e-invoicing mandate due Dec 31, 2026.
  - Both are summarized in the charting session. Sources are secondary (tax-firm alerts) and need validating with a real Reviewer.
- **Skills:** for grilling tickets, call `grilling` and `domain-modeling`, and update GLOSSARY.md as terms resolve.

## Decisions so far

<!-- the index: one line per closed ticket -->
- [SLSP purchases file format](issues/04-slsp-purchases-file-format.md): Export one CSV row per Receipt in the RELIEF template's column order (month-end, seller TIN and branch, name, address, exempt, zero-rated, services, capital goods, other goods, input tax, non-creditable) for a converter to turn into the BIR .DAT. Owner TIN, RDO and period come from Company/Liquidation; the goods/services split is confirmed by the Reviewer.
- [Collect sample receipts](issues/02-collect-sample-receipts.md): 13 real PH receipts renamed with expected outcomes. Fictional demo Company Bayanihan Demo Corp (TIN 123-456-789-00000), demo period 2026-03-30 to 2026-05-02. No ₱1,000+ buyer-TIN receipt yet.
- [Measure OCR and extraction on the 8GB M1](issues/03-measure-extraction-on-m1.md): OCR (ocrmac, with row grouping and rotation) → qwen3:4b, 90% field accuracy, ~15 s per receipt warm. The LLM reads, code decides doc type and formats, and the VAT arithmetic check catches every wrong amount. No vision fallback.
- [Validate the liquidation workflow with the Reviewer contact](issues/01-validate-workflow-with-reviewer-contact.md): closed unvalidated, then **validated later the same day**. The flow, the manual-encoding pain, the checks and "privacy is the priority" were confirmed. New: the Company name and TIN are required on *every* receipt; e-invoices are accepted; falsification is a red flag; the output columns include particulars and withholding tax.
- [Receipt extraction schema](issues/05-receipt-extraction-schema.md): Each Receipt has an immutable Extraction (the LLM copies values as printed: seller, TINs, invoice number, date, 5 amounts, buyer name/TIN, particulars, Expense Category; no line items), a Derived layer (code: doc type, VAT status, normalized TINs/dates, VAT repair, SLSP bucket, duplicate key) and Reviewer Corrections (effective value = correction or derived). The Company has a Buyer Details Rule; the demo Company uses all receipts.
- [Checks and Disallowed Amount rules](issues/06-checks-and-disallowed-amount-rules.md): Severities are REJECT / NEEDS_REVIEW / NO_INPUT_VAT, and a receipt takes its worst open Finding. Auto-reject only on printed evidence; missing → review (except a blank buyer area → reject). Duplicates are checked across all Liquidations. The Reviewer corrects or dismisses with a reason. Totals: Valid Spend, Disallowed, Amount to Return, Excess Spend. Lifecycle OPEN → APPROVED/RETURNED. The demo toggles the Buyer Details Rule live.
- [Question set and query approach](issues/07-question-set-and-query-approach.md): 7 supported questions (open advances, lost input VAT, amount to return, spend by category, worst suppliers, duplicates, review queue). Qwen only picks the question and fills slots (period as an enum resolved by code); fixed SQL templates and code-written answers mean no model-written numbers. Questions jump the extraction queue. English and Taglish.
- [API contract and live events](issues/08-api-contract-and-live-events.md): Agreed contract in [research/08-api-sketch.md](research/08-api-sketch.md). One origin via Next.js rewrites; one Liquidation per Cash Advance; WebSocket events are invalidation hints; questions async; QR phone capture with a token plus device/gallery upload; centavo integers in the DB, peso numbers in the JSON, server-only money arithmetic.
- [Demo script and video plan](issues/09-demo-script-and-video-plan.md): Name **Tally**. 5 min demo with beats mapped to the criteria, the accountant's real ₱15,000 story, 2 live scans over pre-seeded data, the live rule toggle, 3 questions (1 Taglish), a recorded internet-off clip plus a live network monitor, 6 prepared Q&A answers, and one recording cut into a 2 min submission video and a 60 s LinkedIn video. Script in [research/09-demo-script.md](research/09-demo-script.md).

## Not yet specified

- **Cloud sync (optional, later):** if time remains, sync liquidations to the cloud. It must stay clearly separate and optional; the core workflow never needs the network. The open questions are what syncs, conflict handling, and whether it is even demoed.
- **Voice questions:** whisper.cpp on the Mac, if time allows. The transcript would feed the same question picker (see Question set and query approach).
- **Company policy rules (check 8):** which rules (meal caps, allowed categories) and how the Reviewer configures them. It depends on what the contact says.
- **Legibility warning (check 7):** OCR confidence proved useless. The checks already route unreadable values to NEEDS_REVIEW, so a separate check 7 may be unnecessary. Decide only if time remains.
- **E-invoice intake:** the contact accepts e-invoices as well as paper. Should the app take a PDF or e-invoice file (text read directly, no OCR) alongside photos? It depends on the API contract and the remaining time.
- **Anomaly / falsification signals:** the contact distinguishes an invalid receipt (money returned) from a falsified one (a red flag; termination after an audit). Possible signals: the same receipt across different Employees, edited amounts, implausible sequences. These would be shown as a separate RED_FLAG severity. Cross-Liquidation duplicates (check 5) already cover the cheapest signal.
- **Repo layout:** monorepo folders for `api/` and `web/`, the dev scripts and the `setup.sh`. The test strategy itself is decided in API contract and live events.
- **Distribution to real end users:** the hackathon story is likely a setup script plus an office-server pitch (one Mac or mini-PC in the office running Ollama and the backend, with phones and laptops on the LAN). A packaged installer (Tauri, a bundled llama-server, and a GGUF model with no download) is a stretch. Open problem: `ocrmac` is macOS-only, and many PH Reviewers use Windows, so a Windows OCR path (Windows.Media.Ocr, PaddleOCR or RapidOCR) would be needed.
- **AI-generated video:** the team plans to use AI video generation for the submission and LinkedIn cuts. Open questions: which parts (intro, B-roll, captions or voice-over) and keeping the product footage real, since judges score a convincing live product, not a rendered one. Discuss later.

## Out of scope

- **POS system with a cloud-hosted LLM:** cloud inference contradicts the theme's main criterion (local inference must be fundamental).
- **Freelancer 8% / Form 2307 handling:** expense receipts barely matter under the 8% option; it's a different user.
- **On-phone inference:** the research shows phone browsers can't reliably run OCR or a 3–4B model; the phone is capture-only.
- **Vision-model fallback:** measured worse than OCR → qwen3:4b (misreads TINs, invents dates, no faster) and it would need a model swap within 8GB. See [Measure OCR and extraction on the 8GB M1](issues/03-measure-extraction-on-m1.md).
- **Free text-to-SQL for questions:** too unreliable on a 4B model for a live demo; replaced by fixed templates. See [Question set and query approach](issues/07-question-set-and-query-approach.md).
- **Online ATP / permit verification:** this can't be done offline, so findings say "likely valid", never a guarantee.
