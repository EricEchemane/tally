# Map: Local AI Liquidation Review

Label: wayfinder:map

## Destination

A buildable spec for a local-first liquidation review app, with every decision below locked: the extraction schema, the checks, the questions, the API contract and the demo script. It must be ready for two developers to build in a 20-hour remote hackathon (theme: "Local AI", which must stay useful when the cloud disappears).

## Notes

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

## Not yet specified

- **Cloud sync (optional, later):** if time remains, sync liquidations to the cloud. It must stay clearly separate and optional; the core workflow never needs the network. The open questions are what syncs, conflict handling, and whether it is even demoed.
- **Voice questions:** whisper.cpp on the Mac, if time allows. It depends on how the question feature lands.
- **Company policy rules (check 8):** which rules (meal caps, allowed categories) and how the Reviewer configures them. It depends on what the contact says.
- **Legibility warning (check 7):** whether ocrmac's confidence scores are good enough to flag faded thermal receipts. It depends on the M1 measurements.
- **Vision-model fallback:** when to route a receipt to Qwen3-VL 2B instead of OCR plus LLM, and how to swap models within 8GB.
- **Product name, pitch and LinkedIn framing.**
- **Repo layout and test strategy:** how the backend tests protect the API while the teammate iterates on the UI, and what fixtures (sample receipts) the tests use.
- **Distribution to real end users:** the hackathon story is likely a setup script plus an office-server pitch (one Mac or mini-PC in the office running Ollama and the backend, with phones and laptops on the LAN). A packaged installer (Tauri, a bundled llama-server, and a GGUF model with no download) is a stretch. Open problem: `ocrmac` is macOS-only, and many PH Reviewers use Windows, so a Windows OCR path (Windows.Media.Ocr, PaddleOCR or RapidOCR) would be needed.
- **Model warm-up and demo-day machine prep:** memory pressure, keep_alive, closing apps.

## Out of scope

- **POS system with a cloud-hosted LLM:** cloud inference contradicts the theme's main criterion (local inference must be fundamental).
- **Freelancer 8% / Form 2307 handling:** expense receipts barely matter under the 8% option; it's a different user.
- **On-phone inference:** the research shows phone browsers can't reliably run OCR or a 3–4B model; the phone is capture-only.
- **Online ATP / permit verification:** this can't be done offline, so findings say "likely valid", never a guarantee.
