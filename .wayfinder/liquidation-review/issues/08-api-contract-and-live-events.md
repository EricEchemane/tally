# API contract and live events

Type: prototype (HITL)
Status: resolved
Blocked by: 05, 06

## Question

What is the FastAPI ↔ Next.js contract? It covers:
- resources and endpoints for Cash Advances, Receipts (upload from the phone), Findings, Liquidation summary, exports and questions
- the WebSocket events that make the dashboard fill in live while a Receipt goes through OCR → extraction → checks
- how the phone capture page is served over the LAN

Prototype as an OpenAPI sketch plus event list (stub endpoints are fine) to react to. This contract is what the teammate builds the UI against and what the backend tests protect.

## Answer

**The agreed contract is [research/08-api-sketch.md](../research/08-api-sketch.md).** Key decisions:
- **Topology:** Next.js (`-H 0.0.0.0`) rewrites `/api/*` and `/ws` to FastAPI, so the phone and dashboard share one origin and there is no CORS. FastAPI and Ollama stay on localhost.
- **One Liquidation per Cash Advance**, created together. A returned Liquidation reopens the same record.
- **Live events are invalidation hints** (`receipt.stage`, `receipt.ocr_done` with a short text preview, `receipt.updated`, `receipt.failed`, `liquidation.updated`, `question.answered`, `company.updated`, `queue.updated`). The client re-fetches via REST, so REST is the only source of truth; on reconnect, invalidate everything.
- **Questions are async:** `POST /api/questions` → 202 `{question_id}`, then the `question.answered` event, then `GET /api/questions/{id}`. There is a history list.
- **Capture:**
  - A QR code on the Liquidation screen opens `/capture/{id}?t=<token>` on the phone, with **Take photo** and **Choose from gallery** (multiple) buttons.
  - The dashboard also takes drag-and-drop or multi-file uploads.
  - One endpoint accepts several images, one Receipt per file; HEIC is converted on the server.
- **Money:** integer centavos in SQLite (exact SQL); peso numbers with 2 decimals in the JSON. The server does all money arithmetic, and the UI only displays `totals`.
- **Reviewer actions:** corrections, dismissal (reason required), confirm (REJECT, or NO_INPUT_VAT for check 4 only), approve (409 while NEEDS_REVIEW is open), return, reopen. The Buyer Details Rule toggle re-runs the checks on every OPEN Liquidation.
- **Ops:** `GET /api/health` and `POST /api/admin/warmup` as the demo pre-flight.
- **Tests:** pytest against the API with mocked extractions per sample receipt (the expected Findings come from the samples README), plus one real-model test marked `ollama`.

## Comments
- From Checks and Disallowed Amount rules: the endpoints need Reviewer actions (correct a field, dismiss a Finding with a reason, confirm a NEEDS_REVIEW), Liquidation transitions (approve when no open NEEDS_REVIEW, return with reasons), a Company setting for the Buyer Details Rule (its toggle recomputes every Liquidation and should push live events), and Cash Advance fields (amount, Employee, purpose, release date, spending end date).
- From Question set and query approach: a question endpoint returns a sentence, a table, links to records, and a "how I got this" (matched question + period), or a clarifying choice for ambiguous names, or "can't answer" plus the supported list. The LLM job queue must give questions priority over receipt extractions.
