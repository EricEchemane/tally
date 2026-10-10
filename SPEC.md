# Tally: Build Spec

> Every receipt checked against BIR rules, on your own laptop.

This is the one document to build from during the 20-hour hackathon (theme: **Local AI**, "stay useful when the cloud disappears"). Each section summarizes a decision; the linked ticket holds the reasoning. Vocabulary follows [GLOSSARY.md](GLOSSARY.md): use its terms in code, the UI and the pitch.

Sources: [map](.wayfinder/liquidation-review/map.md) · [API contract](.wayfinder/liquidation-review/research/08-api-sketch.md) · [demo script](.wayfinder/liquidation-review/research/09-demo-script.md) · [M1 benchmark](.wayfinder/liquidation-review/research/03-m1-bench/FINDINGS.md) · [sample receipts](samples/receipts/README.md)

---

## 1. Product

**User:** a finance **Reviewer** at a Philippine company who checks an **Employee's** **Liquidation** of a **Cash Advance**.

**Problem** (validated with an accountant who handles liquidations; [ticket](.wayfinder/liquidation-review/issues/01-validate-workflow-with-reviewer-contact.md)):
- Receipts are checked by hand ("eyeballed").
- Receipts must be BIR-compliant and carry the Company's name and TIN.
- A rejected receipt means the Employee returns that money.
- Consolidated reports and the SLSP are always confidential: **"privacy is the priority."**

**What Tally does:**
1. The Reviewer opens a Cash Advance and scans its QR code with a phone (or uploads files).
2. Each receipt photo is read on the Mac (Apple Vision OCR, then qwen3:4b), checked by code against BIR rules, and appears on the dashboard live with ✅ or ⚠️.
3. The Reviewer corrects misreads, dismisses Findings with reasons, and approves or returns the Liquidation.
4. Exports: a Liquidation summary (Excel) and an SLSP-ready purchases CSV.
5. The Reviewer can ask questions in English or Taglish ("How much input VAT did we lose in April?").

**Why local:**
- Employee and Company tax data never leave the office.
- Checking a whole pile of receipts costs nothing.
- It works with no internet.
- **No request leaves the machine.**

**Guiding principle: the LLM reads and interprets; code decides and computes.** The model never decides validity and never writes a number the user sees.

---

## 2. Stack and topology

```
Phone browser ─┐                          ┌─ Ollama :11434 (qwen3:4b, localhost only)
               ├─► Next.js :3000 ─/api,/ws─►│ FastAPI :8000 ─┤
Mac dashboard ─┘   (rewrites; one origin)   └─ SQLite + data/images/ └─ Apple Vision OCR via ocrmac (in-process)
```

- **Backend:** Python 3.12 (uv), FastAPI, `ocrmac`, Pillow + `pillow-heif`, `openpyxl`, SQLite, pytest. **It owns all logic and all tests.**
- **Frontend:** Next.js (client components), react-query, one WebSocket. It is a thin client built against the API contract; Simon owns it.
- **Network:**
  - Next.js runs with `-H 0.0.0.0` on the Mac's LAN IP or a phone hotspot, and rewrites `/api/*` and `/ws` to FastAPI.
  - FastAPI and Ollama stay on localhost.
  - Nothing needs the internet after the setup downloads.
- **Hardware target:** M1 MacBook Pro, **8GB**. Only one model is ever loaded.

**Ollama settings:**
- `model: qwen3:4b`, `think: false`, `temperature: 0`, `format: <JSON Schema>`
- `num_ctx: 4096` (2048 is probably enough), `num_predict: 600`, `keep_alive: -1`
- Environment: `OLLAMA_MAX_LOADED_MODELS=1`

**Fake pipeline mode (for development on Windows):** `TALLY_FAKE_PIPELINE=1` (`TALLY_FAKE_DELAY` scales the simulated delays; tests use 0).
- The backend skips `ocrmac` and Ollama and serves the committed fixtures from `api/tests/fixtures/receipts/<sample>/`, which hold `ocr.txt` and `extraction.json`.
- An upload matching a known sample (by `image_hash`) gets that sample's real OCR text and extraction. An unknown upload gets a random fixture after a ~3 s delay, so the live stages and events still play out.
- The question picker falls back to keyword matching onto the 7 questions.
- Everything else is real: derive, VAT repair, checks, events, exports and questions SQL.
- **`ocrmac` must be imported only inside the real OCR function**, or the app won't start on Windows.
- Real end-to-end runs happen only on Eric's Mac.

---

## 3. Domain model (SQLite)

Money is stored as **integer centavos** (₱355.00 → `35500`). The API sends peso numbers with 2 decimals. **The UI never does money arithmetic; it shows `totals`.**

| Table | Key fields |
|---|---|
| `company` (single row) | `name`, `tin`, `buyer_details_rule` (`ALL_RECEIPTS` \| `AT_1000_AND_ABOVE`) |
| `employee` | `name` |
| `cash_advance` | `employee_id`, `amount`, `purpose`, `released_on`, `spending_end_on` |
| `liquidation` (1:1 with cash_advance, created with it) | `status` (`OPEN` \| `APPROVED` \| `RETURNED`), `return_note`, frozen totals once approved |
| `receipt` | `liquidation_id`, `stage` (`queued → ocr → extracting → checking → done \| failed`), `image_path`, `image_hash`, `rotation`, `ocr_text`, `extraction` (JSON, immutable), `derived` (JSON), `status` |
| `correction` | `receipt_id`, `field`, `value`, `previous`, `at` |
| `finding` | `receipt_id`, `check`, `condition`, `severity`, `state` (`OPEN` \| `DISMISSED` \| `CONFIRMED`), `message`, `amount_affected`, `related_liquidation_id`, `dismissal_reason` |
| `question` | `text`, `state`, `answer` (JSON) |

Demo Company: **Bayanihan Demo Corp, TIN 123-456-789-00000** (fictional), Buyer Details Rule `ALL_RECEIPTS`.

**Starting data** (`TALLY_SEED`, used only when the database is empty):
- `demo` (default): the demo data below.
- `placeholders`: the API tests' data.
- `minimal`: the Company plus one Cash Advance, no receipts.

**Demo data** (`db/demo.py`): instant and model-free. Receipts come from the committed real-pipeline fixtures, then go through derive and the checks.

| Liquidation | Spending Period | Seeded receipts | Demo moment |
|---|---|---|---|
| Juan Dela Cruz, field sales trip, ₱2,500 | 2026-03-30 to 05-02 | 8 real samples | Toggling to ₱1,000+ turns 5 ✅; amount to return ₱2,217.05 → ₱280.40 |
| Juan Dela Cruz, office supplies, ₱1,500 | 2026-10-01 to 10-31 | blurry 7-Eleven (duplicate of the field trip's, amounts misread) | **Live scans:** `bayanihan-corp-1` → ✅ and the 2022 OR → REJECT; the amount correction |
| Maria Santos, pharmacy supplies, ₱1,500 | 2026-09 | 2 Mercury Drug (seller TIN unreadable) | Material for "what needs my review" and per-Employee questions |

**Resetting:** `./demo.sh` (with `./dev.sh` running) resets the data, warms the model, checks health and swap, and prints the dashboard and phone URLs. `POST /api/admin/demo-reset` does the reset alone, and open dashboards refresh through live events.

---

## 4. Receipt pipeline

Decisions from [Measure OCR and extraction on the 8GB M1](.wayfinder/liquidation-review/issues/03-measure-extraction-on-m1.md) and [Receipt extraction schema](.wayfinder/liquidation-review/issues/05-receipt-extraction-schema.md). **Start from the working benchmark code** in `research/03-m1-bench/`:
- `ocr.py`: upright detection and row grouping
- `post.py`: normalization
- `repair.py`: VAT repair

| Step | What | Time on M1 |
|---|---|---|
| 1. Ingest | Save the image; convert HEIC → JPEG; compute `image_hash` | — |
| 2. OCR | `ocrmac` accurate mode on the photo shrunk to **at most 2048 px** (4032 px phone photos OCR 2–2.5× slower with no gain; the stored photo stays full size). **Upright detection:** if the median box is tall and narrow, rotate ±90° and keep the better pass. **Row grouping:** join observations whose vertical centers overlap, left to right. Emit `receipt.ocr_done` with a short preview. | ~0.5 s (1.6 s if rotated) |
| 3. Extraction | One qwen3:4b call over the grouped text, with the JSON Schema below. Goes through the **LLM queue** (questions have priority). | **10–17 s** warm |
| 4. Derive | Code normalization and keyword rules (below), then VAT repair | ms |
| 5. Checks | A pure function, re-run on every change | ms |

**Measured on 18 real receipts** (fixtures, hours 1–4): **91% field accuracy** after derive. Every wrong amount fails the VAT arithmetic check (→ NEEDS_REVIEW), and every seller TIN is right or absent (→ NEEDS_REVIEW). Nothing is silently wrong.

### Extraction (LLM output, immutable; all nullable; never invent values)

`seller_name`, `seller_address`, `seller_tin_raw`, `invoice_number_raw`, `date_raw` (as printed), `buyer_name`, `buyer_tin_raw`, `buyer_address` (display only), `vatable_sales`, `vat_amount`, `vat_exempt_sales`, `zero_rated_sales`, `total`, `particulars` (the model's 2–5 word summary, max 40 characters, e.g. "Rice meals", "Fuel", "Pharmacy items"), `expense_category` (`MEALS` \| `TRANSPORT_FUEL` \| `LODGING` \| `SUPPLIES` \| `OTHER`, decided by the kind of seller).

No line items. The prompt rules, refined from the benchmark:
- The seller is the business at the top. Ignore the POS-provider and accreditation block at the bottom.
- Buyer fields only if filled in on the Name/TIN lines.
- Amounts are plain numbers.
- Copy exactly.

### Derived (code)

- `doc_type`: `OFFICIAL_RECEIPT` if "OFFICIAL RECEIPT" appears; `OTHER` if non-PHP; `INVOICE` if "INVOICE" or an "SI No./#" label appears; otherwise none found (→ NEEDS_REVIEW). A missing TIN never makes a receipt `OTHER`, because it rejects only on evidence.
- `vat_registered`: "NON VAT" → false; "VAT REG" → true; otherwise the LLM's reading.
- `not_valid_notice`: "NOT VALID FOR … INPUT TAX" appears.
- `currency`: from "$", "USD" and similar.
- `seller_tin` (9 digits) and `seller_branch` (3–5 digits):
  - reject MIN-like strings
  - rejoin a TIN that wraps onto the next row; keep the 9 digits when the branch is incomplete (→ NEEDS_REVIEW)
  - **reject a POS-provider TIN**: any TIN found only in the bottom 40% of OCR rows. PH receipts print the seller TIN in the header; on faded tapes only the footer (provider) TIN is legible, and OCR mangles the provider labels too much for keywords.
- `buyer_tin`.
- `invoice_number`: a **labelled OCR line wins** (`SI No.`, `SI Number`, `INVOICE#`, `OR No.`, including a label with the number on the next row), because the LLM confuses MINs and TXN numbers. Otherwise use the LLM's value with prefixes stripped.
- `date`: find the date token inside the raw string (`09-19-26 12:47P DAEZEL`), then parse to ISO (month first, the PH convention).
- **Non-VAT seller** → VATable and VAT become null.
- **VAT repair:** if the arithmetic fails, search the OCR numbers for a VATable / VAT / exempt / total set that satisfies it. Prefer the LLM's total, then exempt = 0. Set `amounts_repaired`.
- `slsp_bucket`: MEALS, LODGING and TRANSPORT → services; fuel and SUPPLIES → other goods.
- `duplicate_key` = seller TIN + branch + invoice number. The total is left out: BIR invoice serials are unique per seller branch, and OCR misreads totals (the blurry 7-Eleven duplicate read ₱284 as ₱1,000).
- `buyer_name` is kept only if it sits on a labelled buyer line (Sold to / Name / Cust Name / Registered Name) and isn't masked. Small models report loyalty names (`EC*****N`), cashier IDs, cardholder names and even name badges in the photo background as buyers.

### Corrections (Reviewer)

- **The value used** for a field is the correction if there is one, otherwise the derived value.
- **Editable:** seller TIN and branch, invoice number, date, the 4 amounts, total, buyer name and TIN, doc type, VAT status, Expense Category, particulars, `withholding_tax` (Reviewer-only, never computed), and **seller name** (display-only).
- Seller name was made editable after the fixtures showed OCR often misses or garbles store names (logos, torn or faded headers), and a prompt change couldn't fix it.
- The original Extraction is always kept.

---

## 5. Checks

From [Checks and Disallowed Amount rules](.wayfinder/liquidation-review/issues/06-checks-and-disallowed-amount-rules.md).

**Severities:**
- `REJECT`: the whole amount is disallowed and the Employee returns it.
- `NEEDS_REVIEW`: blocks approval until resolved.
- `NO_INPUT_VAT`: the spend counts, but its VAT is non-creditable.

**Receipt Status** = the worst *open* Finding: REJECT > NEEDS_REVIEW > NO_INPUT_VAT > accepted.

**Principle:** auto-REJECT only on printed evidence. A missing or unreadable value gives NEEDS_REVIEW.

| # | Check | Condition | Severity |
|---|---|---|---|
| 1 | Document type | "Official Receipt" printed | REJECT |
| | | Non-peso or foreign document | REJECT |
| | | No Invoice/OR title found | NEEDS_REVIEW |
| | | "NOT VALID FOR CLAIM OF INPUT TAX" printed, or Non-VAT seller | NO_INPUT_VAT |
| 2 | Seller TIN | Missing, or not 9 digits + 3–5 digit branch | NEEDS_REVIEW |
| 3 | Buyer details (per the Buyer Details Rule) | Buyer TIN's 9 digits ≠ Company TIN | REJECT |
| | | Buyer area blank (no lines or empty lines) | REJECT |
| | | Something written but TIN unreadable or incomplete | NEEDS_REVIEW |
| | | TIN matches, name differs | accepted (difference noted) |
| 4 | VAT arithmetic (VAT-registered; ±₱0.05; after repair) | VATable × 12% ≠ VAT, or the parts ≠ total | NEEDS_REVIEW |
| | | Total not found (any receipt) | NEEDS_REVIEW |
| | | No VAT breakdown | NEEDS_REVIEW (Reviewer confirms as REJECT or NO_INPUT_VAT) |
| | | Auto-repaired | accepted, with an "auto-corrected" note |
| 5 | Duplicate | Same `duplicate_key` (seller TIN + branch + invoice number) or `image_hash` in **any** Liquidation | REJECT on the later one, naming the earlier |
| 6 | Date | Outside the Spending Period (`released_on`..`spending_end_on`, inclusive) | REJECT |
| | | Date missing | NEEDS_REVIEW |

- The checks are a pure function, `checks.engine.run_checks(effective_receipt, ...) -> findings` (amounts in centavos). `checks.service.recheck_open` persists them.
- **When the checks run:** every processed receipt in every OPEN Liquidation is re-checked after:
  - each extraction
  - each Reviewer action
  - a receipt deletion
  - a Buyer Details Rule change
  - startup

  Duplicates span Liquidations, and the receipt counts are small. APPROVED and RETURNED Liquidations are never re-checked.
- Findings are keyed by `(receipt, check, condition)`, so dismissals and confirmations survive re-runs. A Finding whose condition no longer holds is removed.
- **Condition keys:**
  - `DOC_TYPE`: `official_receipt`, `foreign`, `no_title`, `non_vat`, `not_valid_notice`
  - `SELLER_TIN`: `missing`, `branch_missing`
  - `BUYER_DETAILS`: `tin_mismatch`, `blank`, `unreadable`
  - `VAT_ARITHMETIC`: `mismatch`, `no_breakdown`, `total_missing`
  - `DUPLICATE`: `duplicate`
  - `DATE`: `outside_period`, `missing`
- A foreign receipt (non-PHP) is rejected by check 1 and skips checks 2–4, which would only add noise.
- **Reviewer corrections are validated and normalized:** TINs to digits (a seller TIN typed with its branch is split), dates to ISO, amounts to centavos, enums checked. A bad value returns 422.

**Reviewer actions:**
- **Correct** a field (the checks re-run).
- **Dismiss** a Finding; the reason is required, and it stays visible as dismissed.
- **Confirm** a NEEDS_REVIEW as REJECT, or as NO_INPUT_VAT for check 4 only.

**Totals:**
- Valid Spend = non-rejected receipts.
- Disallowed Amount = rejected receipts (whole amounts).
- Amount to Return = advance − Valid Spend, when positive. Otherwise the difference is Excess Spend (reimbursable, subject to approval).
- Claimable input VAT = the VAT of accepted receipts without NO_INPUT_VAT.

**Liquidation lifecycle:**
- `OPEN` → `APPROVED`: only when no receipt's **status** is NEEDS_REVIEW; it freezes totals.
  - A NEEDS_REVIEW Finding on a receipt that is already REJECT doesn't block. Its whole amount is disallowed either way, and the first rehearsal showed the Reviewer otherwise had to confirm Findings that change nothing.
  - `open_needs_review` counts those receipts.
- `OPEN` → `RETURNED` (the open Findings are the reasons) → `OPEN` again via reopen.

---

## 6. Questions

From [Question set and query approach](.wayfinder/liquidation-review/issues/07-question-set-and-query-approach.md).

**The 7 supported questions:**
1. Open Cash Advances older than N days
2. Input VAT lost in a period, and why
3. Amount to Return per Employee
4. Spend by Expense Category in a period
5. Suppliers with the most invalid receipts
6. Receipts submitted twice
7. What still needs my review

**Anything else gets a pre-written reply** (`questions/replies.py`), in English or Filipino/Taglish to match the message. The model only picks which one; it never writes reply text.

| Message | Reply |
|---|---|
| Greeting ("Hi", "Kumusta") | First message in the history: Tally's introduction plus the 7 questions as clickable suggestions. Later: "Hi again! What would you like to know?" |
| Help ("What can you do?", "Sino ka?") | The introduction |
| Thanks ("Salamat!") | "You're welcome! Ask me anytime." |
| What one of Tally's terms means | A fixed explanation of one of 12 topics: input VAT, the severities, why receipts are rejected (the six checks), Invoice vs Official Receipt, Buyer Details Rule, seller TIN, Spending Period, Amount to Return vs Excess Spend, Liquidation, the SLSP export, dismissing a finding, phone capture. "Why was this receipt rejected?" gets the checks explanation and a pointer to the receipt. |
| Anything else, including attempts to change Tally's instructions | "Sorry, I can only help with your company's cash advances, receipts and liquidations. Try one of these:" plus 4 suggestions |

A greeting together with a supported question is that question. The empty Ask Tally panel shows the introduction (`GET /api/questions/intro`).

**What a message can't do.** The text is cleaned (NFKC, no control or bidi-override characters, at most 300 characters, rejected if empty), and at most 5 questions wait at once, since questions run ahead of receipts. The model sees it JSON-encoded, as data to classify. Its output is held to a JSON schema of enums and re-validated in code, so the worst a message can do is pick the wrong fixed reply or the wrong supported question. Answers come only from read-only, parameterized SQL templates, and the page shows them as text, never HTML.

**How a question is answered** (`llm/question_picker.py`, `questions/service.py`):
1. **The pick.** One qwen3:4b call returns `{question_id (0 = not a supported question), employee, expense_category, period, days, reply, topic, language}`, about 50 output tokens. The prompt describes each question with Filipino synonyms, each reply and topic, and has English/Filipino/Taglish examples, including injection attempts. The output is validated in code; anything malformed becomes null, question 0 or the off-topic reply.
   - **Measured on the Mac: 16/16 exact** on English, Filipino and Taglish phrasings, 10 of them outside the prompt's examples. **~2–3 s** per question (~6 s cold).
   - **Measured on Windows (8 GB laptop, CPU), 2026-10-10: 34/34** with the replies added: the 16 questions, 10 replies from the examples and 8 outside them, among them 4 injection attempts. **~5 s** per message.
   - In fake pipeline mode, a keyword picker stands in for the model.
2. `period` is `THIS_MONTH | LAST_MONTH | THIS_QUARTER | LAST_QUARTER | THIS_YEAR | MONTH:MM | MONTH:YYYY-MM | RANGE:a..b`. The model writes `MONTH:04` for "Abril", because it never knows the year. **Code resolves the dates** (`templates.resolve_period`; `MONTH:MM` = the most recent such month on or before today).
3. **The Employee is resolved in code:** every word typed must start a word of the name, so "Juan" matches Juan Dela Cruz.
   - Two or more matches: `kind: "clarify"`, with choices whose `text` is the question re-worded with the full name; re-asking it resolves the name.
   - No match: "couldn't find" plus a list of Employees.
4. Code calls `questions.templates.run(conn, question_id, slots, today)` (Simon). It runs a fixed, parameterized, read-only SQL template (one pytest test each) and writes an English answer from a template. **No model-written numbers.**
   - `slots = {employee_id, employee_name, expense_category, period, days}`
   - `today = config.today()`; pin it with `TALLY_TODAY=YYYY-MM-DD` for rehearsals.
   - Until the templates exist, the answer says which question was understood.
5. The answer shows a sentence, a table, links into the records, and a "how I got this" line (the matched question and the period).
6. Questions are async and **jump the LLM queue**: the worst-case wait is one receipt (~15 s).

---

## 7. API and live events

**The full contract is in [research/08-api-sketch.md](.wayfinder/liquidation-review/research/08-api-sketch.md).** Summary:

**Company and records:**
- `GET/PATCH /api/company`. The PATCH toggles the Buyer Details Rule and recomputes every OPEN Liquidation.
- `GET/POST /api/employees`, `GET/POST /api/cash-advances` (creates the Liquidation too)

**Liquidations:**
- `GET /api/liquidations/{id}`
- `POST /api/liquidations/{id}/approve` (409 while NEEDS_REVIEW is open), `.../return`, `.../reopen`
- `GET /api/liquidations/{id}/capture-link`, which returns the QR code and token

**Receipts and Reviewer actions:**
- `POST /api/liquidations/{id}/receipts`: multipart, multiple images, returns 202. The phone sends the `?t=` token.
- `GET /api/receipts/{id}`, `.../image`, `DELETE`
- `POST/DELETE /api/receipts/{id}/corrections`
- `POST /api/findings/{id}/dismiss` `{reason}`, `POST /api/findings/{id}/confirm` `{as}`

**Questions and exports:**
- `POST /api/questions` → 202 `{question_id}`; `GET /api/questions/{id}`; `GET /api/questions` (history)
- `GET /api/liquidations/{id}/summary.xlsx`. Columns, per the accountant: TIN, date, seller name, seller address, particulars, amount, withholding tax, VAT, VAT-exempt, plus status, Findings and a totals block.
- `GET /api/exports/slsp.csv?month=YYYY-MM`. Non-rejected receipts; NO_INPUT_VAT receipts go in the non-creditable column. Columns:
  `month_end,seller_tin,seller_branch_code,registered_name,last_name,first_name,middle_name,address1,address2,exempt,zero_rated,services,capital_goods,other_goods,taxable_net_of_vat,input_tax,non_creditable_input_tax,gross_purchases,invoice_no,invoice_date,owner_tin,liquidation_id,receipt_id`

**Ops:** `GET /api/health`, `POST /api/admin/warmup`.

**Capture:**
- Phone page `/capture/{id}?t=`: **Take photo** (`capture="environment"`) and **Choose from gallery** (`multiple`).
- Dashboard: drag-and-drop or a multi-file picker.

**WebSocket `/ws`:** events are **invalidation hints**; the client re-fetches over REST and invalidates everything on reconnect.
- `receipt.stage`, `receipt.ocr_done` (with a preview), `receipt.updated`, `receipt.failed`
- `liquidation.updated`, `question.answered`, `company.updated`, `queue.updated`

**LLM worker:** one asyncio priority queue (questions = 0, receipts = 1). OCR runs outside the queue.

---

## 8. Tests (nobody merges with failing pytest)

- pytest against the API in **fake pipeline mode**. The fixtures (`ocr.txt` + `extraction.json` per sample) are generated once by Eric on the Mac by running the real pipeline on every file in `samples/receipts/`, then committed. The whole suite runs on Windows and macOS.
- Expected statuses and Findings come from `samples/receipts/README.md`, re-evaluated against §5. Under `ALL_RECEIPTS`, every real sample also gets the blank-buyer REJECT. The synthetic receipts are the passing cases.
- Unit tests:
  - row grouping and upright detection
  - TIN, date and invoice normalization
  - VAT repair (Lawson, Petron, llaollao)
  - every check condition
  - totals, including Excess Spend
  - the lifecycle (approve 409)
  - each question template
  - period resolution
- One real-model test marked `@pytest.mark.ollama` (skipped by default).

---

## 9. Build plan (20 h, Eric on macOS + Simon on Windows)

**Why the split looks like this:** OCR (`ocrmac`) only runs on macOS, and the demo machine is Eric's 8GB MacBook. So Eric owns everything that touches Apple OCR, the model, or the demo machine. Simon owns the web app and the backend modules that only read the database, and works against the real backend in fake pipeline mode (§2).

### Ownership

| | Eric (MacBook) | Simon (Windows) |
|---|---|---|
| **Code** | `api/pipeline/` (ingest, HEIC, OCR, extraction, derive, VAT repair), `api/llm/` (Ollama client, prompts, priority queue, question picker), `api/checks/` (checks, totals, lifecycle, Reviewer actions), `api/routes/` + WebSocket, `api/db/` (**schema and migrations**), fake pipeline mode, `setup.sh` | `web/` (all of Next.js), `api/exports/` (summary `.xlsx`, SLSP CSV), `api/questions/templates/` (7 SQL templates, period resolution, answer sentences) |
| **Tests** | Pipeline, normalization, repair, checks, totals, lifecycle, API routes | Exports, question templates, period resolution |
| **Fixtures and data** | Generates and commits the per-sample fixtures; seed script; synthetic receipts and blurring (has the physical receipts) | — |
| **Demo** | Demo machine: network monitor, internet-off hotspot clip, live run, raw screen recordings | Slides, video editing (incl. AI-generated parts), LinkedIn cut, public README |

**Interfaces Simon's modules plug into:**
- `exports.summary_xlsx(liquidation_id) -> bytes`
- `exports.slsp_csv(month) -> str`
- `questions.run(question_id, slots, today) -> Answer`

All of them read the DB through Eric's schema; Eric wires the routes to them.

### Hour 0 (together, ~30 min)
1. Walk through the API contract and the fixture format.
2. Agree the folder ownership above.
3. Add `.gitattributes` (`* text=auto eol=lf`) for Windows/macOS line endings.
4. Agree the rules: the UI never does money arithmetic; nobody merges with failing `pytest`; only Eric changes the schema (Simon asks).
5. Eric pushes the schema and stub routes that return the contract's example payloads, so Simon can start.

### Eric (MacBook)

| Hours | Work | Done when |
|---|---|---|
| 0–1 | Repo `api/` + `web/` skeleton, `setup.sh`, SQLite schema, stub routes, seed Company | Simon can run `api` + `web` locally |
| 1–3 | Pipeline: port `ocr.py`/`post.py`/`repair.py`, extraction call, derive. **Generate and commit the fixtures** for all samples. | Fixtures pushed (Simon's tests depend on them) |
| 3–4 | Fake pipeline mode | Simon runs the real backend on Windows |
| 4–7 | Checks, totals, lifecycle, Reviewer actions + tests | Check table §5 fully covered |
| 7–10 | Real routes, LLM priority queue, WebSocket events, capture token/QR link, HEIC | API tests green; events fire end to end on the Mac |
| 10–12 | Question picker (LLM call + Taglish examples); wire Simon's templates and exports into routes | The demo questions answer on the real model |
| 12–14 | Seed script (2 Liquidations, ~8 processed receipts, the duplicate, the misread 7-Eleven), warmup/health, synthetic receipt photos | One-command demo reset |
| **14** | **Feature freeze** | |
| 14–20 | Integration bugs on the Mac, rehearse 3×, record the internet-off clip and full takes; hand the raw footage to Simon by hour 17 | |

### Simon (Windows)

| Hours | Work | Done when |
|---|---|---|
| 0–3 | Next.js skeleton, rewrites, react-query, WebSocket client, design system; screens against the stub routes | Liquidation screen renders contract data |
| 3–8 | Real screens in fake pipeline mode: Cash Advance list/create, Liquidation (totals, receipts, live stages, OCR preview), receipt detail (image, fields, Findings, correct/dismiss/confirm), approve/return, rule toggle | The full Reviewer flow works on Windows |
| 8–11 | `api/exports/` (summary `.xlsx` with the accountant's columns, SLSP CSV) and `api/questions/templates/` (7 SQL templates + period resolution + sentences) + tests | pytest green; Eric can wire them |
| 11–14 | Phone capture page (Take photo / Choose from gallery), QR display, drag-drop upload, questions panel (async answers, "how I got this", clarify choices) | Everything in §7 has a screen |
| **14** | **Feature freeze** | |
| 14–17 | UI polish only (no API changes); fix bugs Eric reports from Mac runs; slides | |
| 17–20 | Edit the ~2 min submission cut and the ~60 s vertical LinkedIn cut from Eric's footage; public README | |

**Syncing:**
- Short-lived branches per area, merged to `main` often (at least every 2 hours).
- Eric pulls Simon's UI onto the Mac for real end-to-end runs at hours 8, 12 and 14.
- **Same room:** for a real run any time, Simon points his `web/` rewrite at Eric's Mac over the shared Wi-Fi (`API_URL=http://<eric-mac-ip>:8000`). Eric starts FastAPI with `--host 0.0.0.0` **during development only**; in the demo it stays on localhost. Fake pipeline mode remains Simon's default, so the 8GB Mac isn't loaded twice.

**Cut list if behind** (cut in this order):
1. The SLSP CSV
2. Excel → CSV for the summary
3. Questions 1, 3, 5, 7 (keep 2, 4, 6)
4. HEIC conversion
5. Reopen
6. Gallery multi-select

**Never cut:**
- live stages and OCR preview
- checks 1–6 and the rule toggle
- corrections/dismiss
- the approve block
- the internet-off clip

---

## 10. Demo

The full script is in [research/09-demo-script.md](.wayfinder/liquidation-review/research/09-demo-script.md). Format: 5 min demo + 3 min Q&A. Both are in the same room. Eric narrates and drives the dashboard on the Mac. Simon holds the phone (on the Mac's network), watches the network monitor window, starts the internet-off clip, and takes the deployment and e-invoice Q&A questions.

1. Problem (the accountant's words)
2. Why local
3. QR + 2 live scans over pre-seeded data
4. Rule toggle + duplicate + correction
5. 3 questions (2 Taglish): amount to return, duplicates, what still needs review
6. Approve blocked, then resolved and approved, then exports
7. The internet-off clip + "90%, every wrong amount caught"

**Pre-flight:**
- **Restart the Mac** beforehand. Swap builds up over a day of work (9 GB measured) and pushes the model's weights out, which slows the first receipts.
- Start `MODE=demo ./dev.sh` (production web build: no file watchers, no first-visit page compiles on stage), then `./demo.sh` (reset, warm-up, health and swap check).
- Open only Terminal and one browser tab. Test the QR once.

**Fallback:** "this one's already processed."

---

## 11. Not in this build

- **Open questions, only if time remains** (see the [map](.wayfinder/liquidation-review/map.md)): cloud sync (optional, clearly separate), voice questions, policy rules (check 8), the legibility check, e-invoice/PDF intake, falsification RED_FLAGs, AI-generated video, Windows/installer distribution.
- **Out of scope:**
  - a POS with a cloud LLM
  - freelancer 2307 handling
  - on-phone inference
  - online ATP verification (findings say "likely valid")
  - a vision-model fallback
  - free text-to-SQL
