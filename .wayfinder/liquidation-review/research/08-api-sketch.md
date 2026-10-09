# API contract (agreed)

Agreed in **API contract and live events**: FastAPI owns all logic and tests; Next.js is a thin client using react-query plus one WebSocket. The names follow GLOSSARY.md. Dates are ISO.

**Money:**
- SQLite stores **integer centavos** (₱355.00 → `35500`), so SQL `SUM` and comparisons are exact.
- Python uses `Decimal` at the boundaries.
- The JSON carries **peso numbers with 2 decimals** (`355.0`).
- **The server does all money arithmetic; the UI never adds up money.** It shows `totals`.

## Topology

```
Phone (Safari/Chrome) ─┐                          ┌─ Ollama :11434 (qwen3:4b, localhost only)
                       ├─► Next.js :3000 ─/api/*─►│ FastAPI :8000 ─┤
Mac browser (dashboard)┘   (rewrites, one origin)  └─ SQLite + data/images/   └─ Apple Vision OCR (in-process)
```

- Run Next.js with `-H 0.0.0.0` on the Mac's LAN IP or a phone hotspot; no internet needed.
- Next.js rewrites `/api/*` and `/ws` to FastAPI, so the phone and dashboard use one origin and there is no CORS.
- FastAPI and Ollama stay bound to localhost.

## Resources

### Company (single, seeded)
- `GET  /api/company` → `{name, tin, buyer_details_rule: "ALL_RECEIPTS"|"AT_1000_AND_ABOVE"}`
- `PATCH /api/company` `{buyer_details_rule}` → re-runs the checks on every OPEN Liquidation and emits `liquidation.updated` for each one. This is the live-toggle demo moment.

### Employees
- `GET /api/employees` and `POST /api/employees` `{name}`

### Cash Advances
Creating a Cash Advance creates its Liquidation (1:1).
- `GET  /api/cash-advances?status=OPEN|APPROVED|RETURNED` → a list with `{id, employee, amount, purpose, released_on, spending_end_on, liquidation: {id, status, totals}}`
- `POST /api/cash-advances` `{employee_id, amount, purpose, released_on, spending_end_on}` → 201

### Liquidations
- `GET  /api/liquidations/{id}` →
  ```json
  { "id": 7, "status": "OPEN", "cash_advance": {...},
    "totals": {"advance": 15000.0, "valid_spend": 14500.0, "disallowed": 355.0,
               "amount_to_return": 500.0, "excess_spend": 0.0, "claimable_input_vat": 1210.5},
    "open_needs_review": 1,
    "receipts": [{"id": 31, "stage": "done", "status": "REJECT", "seller_name": "...", "date": "2026-04-03",
                  "total": 355.0, "thumbnail_url": "...", "open_findings": 2}] }
  ```
- `POST /api/liquidations/{id}/approve` → 200, or **409** `{error: "open_needs_review", receipt_ids: [...]}`
- `POST /api/liquidations/{id}/return` `{note?}` → RETURNED. The open Findings are the reasons.
- `POST /api/liquidations/{id}/reopen` → OPEN (when the Employee brings replacements).
- `GET  /api/liquidations/{id}/capture-link` → `{url, qr_svg}`. The phone opens `/capture/{id}?t=<token>`.

### Receipts
- `POST /api/liquidations/{id}/receipts` (multipart, **one or more** `images`; the phone sends a `?t=` token, the dashboard doesn't need one since it's the same origin) → **202** `[{id, stage: "queued", queue_position}]`. Each file is its own Receipt. Only allowed while the Liquidation is OPEN. Accepts JPEG/PNG/HEIC; HEIC is converted on the server (pillow-heif or `sips`).
  - **Phone capture page** `/capture/{id}?t=`: two buttons, **Take photo** (`<input accept="image/*" capture="environment">`) and **Choose from gallery** (`<input accept="image/*" multiple>`).
  - **Dashboard:** drag-and-drop or a multi-file picker on the Liquidation screen.
- `GET  /api/receipts/{id}` →
  ```json
  { "id": 31, "liquidation_id": 7, "stage": "done", "status": "NEEDS_REVIEW",
    "image_url": "/api/receipts/31/image", "rotation": 0, "ocr_text": "...",
    "extraction": { "seller_tin_raw": "240-727-673-00006", "...": "..." },
    "derived":    { "doc_type": "INVOICE", "seller_tin": "240727673", "seller_branch": "00006", "amounts_repaired": false, "...": "..." },
    "corrections": [{"field": "total", "value": 284.0, "at": "...", "previous": 1000.0}],
    "effective":  { "seller_tin": "...", "total": 284.0, "...": "..." },
    "findings": [{"id": 90, "check": "BUYER_DETAILS", "severity": "REJECT", "state": "OPEN",
                  "message": "No Company name/TIN on the receipt (required on all receipts)",
                  "amount_affected": 355.0, "related": null,
                  "dismissal_reason": null}] }
  ```
- `GET  /api/receipts/{id}/image`
- `DELETE /api/receipts/{id}` (OPEN Liquidation only)
- `stage`: `queued → ocr → extracting → checking → done | failed`

### Reviewer actions
Each one re-runs the checks, returns the updated receipt, and emits events.
- `POST   /api/receipts/{id}/corrections` `{field, value}`. Only the editable fields from the Receipt extraction schema; otherwise 422.
- `DELETE /api/receipts/{id}/corrections/{field}` (revert to the derived value)
- `POST   /api/findings/{id}/dismiss` `{reason}`. The reason is required (422 if empty).
- `POST   /api/findings/{id}/confirm` `{as: "REJECT"|"NO_INPUT_VAT"}`. NEEDS_REVIEW only; NO_INPUT_VAT is allowed only for check 4.

### Questions
- `POST /api/questions` `{text}` → **202** `{question_id}` immediately. The answer arrives later: the socket sends `question.answered {question_id}`, then the client fetches it.
- `GET  /api/questions/{id}` → `{id, text, state: "queued"|"answering"|"done", answer}`, where `answer` is:
  ```json
  { "kind": "answer", "sentence": "You lost ₱412.30 of input VAT in April 2026: ₱355.00 from rejected receipts, ₱57.30 non-creditable.",
    "table": {"columns": ["Reason", "Receipts", "VAT"], "rows": [["Official Receipt", 1, 0.0]]},
    "links": [{"label": "BF Sinangag", "href": "/receipts/31"}],
    "how": {"question_id": 2, "question": "Input VAT lost and why", "period": {"from": "2026-04-01", "to": "2026-04-30"}} }
  ```
  - `kind: "clarify"` → `{sentence, choices: [{label, text}]}`. Re-asking with the choice's text resolves it.
  - `kind: "unsupported"` → `{sentence, supported: [...7 questions]}`
- `GET  /api/questions` → the history (newest first), for a chat-like panel

### Exports
- `GET /api/liquidations/{id}/summary.xlsx`: the contact's columns (TIN, date, seller name, seller address, particulars, amount, withholding tax, VAT, VAT-exempt) plus status and Findings, with a totals block.
- `GET /api/exports/slsp.csv?month=2026-04`: SLSP-ready columns from the SLSP research; non-rejected receipts only.

### Ops
- `GET /api/health` → `{ollama: "up", model: "qwen3:4b", model_loaded: true, queue: {length, current}}`. This is the demo pre-flight check.
- `POST /api/admin/warmup`: loads the model before the demo.

## Live events: `GET /ws` (one socket, all events, JSON)

Events are **invalidation hints with small fields**. The client calls `queryClient.invalidateQueries` for the named keys and re-fetches via REST, so state lives only in the API.

| Event | Payload | Client invalidates |
|---|---|---|
| `receipt.stage` | `{receipt_id, liquidation_id, stage, queue_position}` | `["receipt", id]`, `["liquidation", lid]` |
| `receipt.ocr_done` | `{receipt_id, preview: "BF SINANGAG EXPRESS…"}` (first rows, under 1 s, so something shows instantly) | (display only) |
| `receipt.updated` | `{receipt_id, liquidation_id, status, open_findings}` (after checks, corrections, dismissals) | `["receipt", id]`, `["liquidation", lid]` |
| `receipt.failed` | `{receipt_id, error}` | `["receipt", id]` |
| `liquidation.updated` | `{liquidation_id, status, totals}` | `["liquidation", lid]`, `["cash-advances"]` |
| `question.answered` | `{question_id}` | `["question", id]`, `["questions"]` |
| `company.updated` | `{buyer_details_rule}` | `["company"]` |
| `queue.updated` | `{length, current: {kind: "receipt"\|"question", id}}` | (status bar) |

On reconnect the client invalidates everything. There is no replay, because REST is the source of truth.

## Internals that shape the contract

- **One LLM worker**: an asyncio priority queue, questions = 0 and receipts = 1. OCR runs outside the queue (Neural Engine), so `receipt.ocr_done` fires immediately.
- **Checks are a pure function** `(effective_receipt, company, cash_advance, other_receipts) -> findings`, re-run on every change. Dismissals are keyed by `(receipt, check, condition)` so they survive re-runs.
- **Tests**: pytest hits the API with the LLM mocked by fixture extractions, one per sample receipt. The expected Findings come from `samples/receipts/README.md`. One slow test, marked `@pytest.mark.ollama`, runs the real model. The teammate's UI work can't break these.
