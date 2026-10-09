# Receipt extraction schema

Type: grilling (HITL)
Status: resolved
Blocked by: 01, 03, 04

## Question

Which fields does the app extract from each Receipt, with what types and nullability? This is the JSON Schema passed to Ollama and the shape of the stored Receipt. Which fields come from OCR + LLM, which are computed in code, and which does the Reviewer correct by hand when extraction is wrong?

It must cover what checks 1–6 need, what the Liquidation summary and the SLSP CSV need (see the SLSP purchases file format ticket), and what the M1 measurements showed the model can reliably extract.

## Answer

A Receipt has three layers: **Extraction**, **Derived** and **Corrections**. Checks and exports always use the effective value: the correction if there is one, otherwise the derived value. They re-run after any correction. (Terms: see GLOSSARY.md.)

1. **Extraction**: one qwen3:4b call over the grouped OCR text, with a JSON Schema. It is immutable once stored. Every field is nullable; the model must never invent a value.
   - **Copied as printed:** `seller_name`, `seller_address`, `seller_tin_raw`, `invoice_number_raw`, `date_raw`, `buyer_name`, `buyer_tin_raw`, `buyer_address` (display only, never checked)
   - **Amounts** (number): `vatable_sales`, `vat_amount`, `vat_exempt_sales`, `zero_rated_sales`, `total`
   - **Suggestions:** `particulars` (short text, e.g. "2 rice meals"); `expense_category` enum `MEALS | TRANSPORT_FUEL | LODGING | SUPPLIES | OTHER`
   - **No line items:** totals only, to keep output tokens and latency down.
2. **Derived** (code):
   - `doc_type` (`INVOICE | OFFICIAL_RECEIPT | OTHER`, by keyword), `vat_registered`, `not_valid_notice`, `currency`
   - `seller_tin` (9 digits) and `seller_branch` (3–5 digits). Reject a MIN read as a TIN; rejoin a TIN that wraps across lines.
   - `buyer_tin`, `invoice_number` (prefix stripped), `date` (ISO)
   - Amounts after the VAT repair, plus an `amounts_repaired` flag
   - `slsp_bucket`, mapped from the Expense Category: meals, lodging and transport → services; fuel and supplies → other goods
   - `duplicate_key` (seller TIN + invoice number + total) and `image_hash`
3. **Corrections**: one record per (field, new value, Reviewer, time); the original Extraction is kept.
   - **Editable:** seller TIN and branch, invoice number, date, the 4 amounts, total, buyer name and TIN, doc type, VAT status, Expense Category, particulars, `withholding_tax`.
   - `withholding_tax` is Reviewer-only: never computed, blank in the export unless filled.
   - Seller name and address are display-only.
4. **Kept for reference:** image path, rotation, OCR text (grouped rows).

**Company:** name, TIN and the **Buyer Details Rule** (`ALL_RECEIPTS | AT_1000_AND_ABOVE`). The demo Company, Bayanihan Demo Corp, uses `ALL_RECEIPTS`, matching the contact's practice. Check 3 compares name and TIN only.

**Liquidation summary export** must carry the contact's columns: TIN, date, seller name, seller address, particulars, amount, withholding tax, VAT, VAT-exempt.

## Comments

- From the SLSP research: the CSV needs seller TIN + branch, registered name, address, date, invoice number, net VATable amount, VAT, exempt, zero-rated, total and document type. Services/goods/capital goods is suggested by the LLM and confirmed by the Reviewer. Branch code may be 3 or 5 digits (an unverified source says RMC 36-2026 changed it), so accept both. See [findings](../research/04-slsp-format.md).
- From Measure OCR and extraction on the 8GB M1: have the LLM copy the date as printed (code parses it). Doc type, VAT/Non-VAT and the "NOT VALID" notice are decided by keyword matching in code, so they can leave the LLM schema; fewer output fields should also cut the ~14 s latency. The LLM must not return a MIN as the TIN, so validate the shape: 9 digits plus a 3–5 digit branch. Rejoin a TIN that wraps across lines.
