# Checks and Disallowed Amount rules

Type: grilling (HITL)
Status: resolved
Blocked by: 01, 05

## Question

For each MVP check (1–6), decide:
- its exact rule over the extracted Receipt fields
- the severity of the Finding it raises (blocks the whole amount, blocks the input VAT only, or a warning)
- how it changes the Disallowed Amount
- how the Liquidation totals (valid spend, Disallowed Amount, amount to return) are computed from the Findings

It also covers edge cases: Non-VAT sellers, receipts under ₱1,000, missing fields because OCR failed rather than the Receipt being defective, and the Reviewer overriding a Finding.

## Answer

**Severities** (see GLOSSARY.md): `REJECT` (the whole receipt amount is disallowed and the Employee returns it), `NEEDS_REVIEW` (blocks approval until the Reviewer resolves it) and `NO_INPUT_VAT` (the spend counts; its VAT is non-creditable). RED_FLAG stays in the map's fog.
- **Receipt Status** is the worst *open* Finding: REJECT > NEEDS_REVIEW > NO_INPUT_VAT > accepted.
- **Principle:** auto-REJECT only on printed evidence. A value that is missing or unreadable gives NEEDS_REVIEW.
- Every check runs on every receipt, over effective values (correction or derived), and re-runs after any correction.

| Check | Condition | Severity |
|---|---|---|
| 1 Document type | "Official Receipt" printed | REJECT |
| | Non-peso currency / foreign document | REJECT |
| | No Invoice/OR title found | NEEDS_REVIEW |
| | "NOT VALID FOR CLAIM OF INPUT TAX" printed, or Non-VAT seller | NO_INPUT_VAT |
| 2 Seller TIN | Missing, or not 9 digits + 3–5 digit branch | NEEDS_REVIEW |
| 3 Buyer details (per the Company's Buyer Details Rule) | Buyer TIN present, 9 digits ≠ Company TIN | REJECT |
| | Buyer area blank (no lines or empty lines) | REJECT |
| | Something written but TIN unreadable or incomplete | NEEDS_REVIEW |
| | TIN matches, name differs | accepted (the name difference is noted) |
| 4 VAT arithmetic (VAT-registered sellers; ±₱0.05, after auto-repair) | VATable × 12% ≠ VAT, or the parts ≠ total | NEEDS_REVIEW |
| | No VAT breakdown at all | NEEDS_REVIEW (Reviewer confirms as REJECT or NO_INPUT_VAT) |
| | Amounts auto-repaired | accepted, with a visible "auto-corrected" note |
| 5 Duplicate | Same seller TIN + invoice number + total, or identical image hash, in **any** Liquidation of the Company | REJECT on the later one, naming the earlier Liquidation |
| 6 Date | Outside the Spending Period (release date to spending end date, inclusive, no grace) | REJECT |
| | Date missing | NEEDS_REVIEW |

**Reviewer actions:**
- **Correct** a field when it was misread; the checks re-run.
- **Dismiss** a Finding with a required reason; it stays visible as dismissed (the audit trail).
- **Confirm** a NEEDS_REVIEW as REJECT, or (check 4 only) downgrade it to NO_INPUT_VAT.

**Totals:**
- **Valid Spend** = the effective totals of non-rejected receipts.
- **Disallowed Amount** = the rejected receipts, whole amounts. Partial amounts come only with policy caps (check 8, stretch).
- **Amount to Return** = advance − Valid Spend, when positive. Otherwise the difference is shown as **Excess Spend** (reimbursable, subject to approval).
- **Claimable input VAT** = the VAT of accepted receipts without NO_INPUT_VAT.
- The **SLSP export** covers non-rejected receipts; NO_INPUT_VAT receipts go into `non_creditable_input_tax`.

**Cash Advance:** amount, Employee, purpose, release date, spending end date.

**Liquidation lifecycle:**
- `OPEN`, then `APPROVED` or `RETURNED`.
- APPROVED requires no open NEEDS_REVIEW, and it freezes the totals.
- RETURNED carries the open Findings as reasons; the Employee adds or replaces receipts and it goes back to OPEN.

**Demo:**
- Add 1–2 synthetic receipts with "Bayanihan Demo Corp" and its TIN handwritten on the buyer lines (Petron, 7-Eleven), to show an accepted receipt.
- Toggle the Buyer Details Rule live (all receipts vs. ₱1,000 and above) and let the Liquidation recompute.

## Comments

- From Collect sample receipts: there is no ₱1,000+ invoice with buyer name/TIN yet, so check 3's passing case has no fixture. Decide whether a synthetic one (Bayanihan Demo Corp TIN) is acceptable for tests and the demo.
- From Measure OCR and extraction on the 8GB M1: the VAT arithmetic check (check 4) also catches extraction errors. It flagged every wrong amount, and an auto-repair from the OCR numbers fixes most. Decide how a Finding distinguishes "the receipt's math is wrong" from "we couldn't read it, so the Reviewer should confirm". OCR confidence is useless for legibility.
- From Receipt extraction schema and the contact's answers:
  - The contact requires the Company name and TIN on **every** receipt, so check 3 follows the Company's Buyer Details Rule (`ALL_RECEIPTS` for the demo) and compares name and TIN only.
  - Under `ALL_RECEIPTS`, all 13 samples fail check 3. Decide whether the demo adds a synthetic receipt with Bayanihan Demo Corp's name/TIN (to show a ✅), or lets every sample show the Finding.
  - A rejected receipt means the Employee returns that money. A falsified receipt is a separate red flag (see the "Anomaly / falsification signals" item in the map's Not yet specified section).
  - Checks run on effective values (correction or derived) and re-run after any correction.

