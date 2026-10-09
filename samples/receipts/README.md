# Sample receipts

These are real Philippine receipts used for the M1 extraction measurement, for test fixtures and for the demo. The real-pipeline fixtures for each one are in `api/tests/fixtures/receipts/<file stem>/`; hand-read ground truth is in `api/tests/expected.py`.

**Under the demo Company's `ALL_RECEIPTS` rule, every receipt here also gets the blank-buyer REJECT (check 3).** The "Expected" column describes the other checks. The 5 receipts added later are dated Aug–Sep 2026, so they fall outside the demo Spending Period. "Expected" is what the app should conclude once checks 1–6 run (plus check 7 for legibility). It assumes a demo Cash Advance period of **2026-03-30 to 2026-05-02** and the made-up demo **Company: Bayanihan Demo Corp, TIN 123-456-789-00000** (fictional, so no real TIN goes into the public repo). It is not the buyer on any of these.

| File | Seller | Doc type (as printed) | VAT status / seller TIN | Date | Total | VAT breakdown | Expected | What it tests |
|---|---|---|---|---|---|---|---|---|
| `valid-bf-sinangag.jpg` | BF Sinangag Express Food Corp | Sales Invoice | VAT · 240-727-673-00006 | 2026-04-03 | 355.00 | 316.96 / 38.04 ✓ | **Valid** | Baseline clean VAT invoice, 5-digit branch |
| `valid-7eleven.jpg` | PerPet Pilipinas Corp (7-Eleven) | Invoice | VAT · 008-578-970-030 | 2026-04-21 | 284.00 | 253.57 / 30.43 ✓ | **Valid** | 3-digit branch; supplier TIN vs POS-provider TIN both on the receipt |
| `dup-7eleven-blurry.jpg` | same 7-Eleven receipt | Invoice | same | same | same | same | **Duplicate** of `valid-7eleven.jpg`; also blurry/crumpled | Check 5 (duplicate, different photo); check 7 (legibility) |
| `valid-mrdiy-date-cropped.jpg` | Bricolage Philippines Inc (Mr DIY) | Sales Invoice | VAT · 010-057-617-00144 | 2026-04-12 (cut off in this photo) | 122.00 | 108.93 / 13.07 ✓ | **Valid** (the date may need Reviewer input) | Missing date field because of cropping |
| `dup-mrdiy-rotated.jpg` | same Mr DIY receipt, rotated 90° | Sales Invoice | same | 2026-04-12 | same | same | **Duplicate** of `valid-mrdiy-date-cropped.jpg` | Rotation handling; check 5 |
| `valid-lawson-torn.jpg` | Lawson (IFC MSA Prime Center) | Sales Invoice | VAT · 121-553-541-00002 | 2026-04-06 | 105.00 | 93.75 / 11.25 ✓ | **Valid** | Torn header; labels and values misaligned (hard layout) |
| `valid-petron-fuel.jpg` | Primera Clase Gas Station Inc (Petron) | Sales Invoice | VAT · 007-851-409-0000 | 2026-04-03 | 282.95 | 252.63 / 30.32 ✓ | **Valid** | Fuel/transport; 4-digit branch printed; scribbled buyer name "23" |
| `valid-landmark-vat-exempt-mix.jpg` | Citysuper Alabang Inc (Landmark) | Sales Invoice | VAT · 009-149-884-000 | 2026-05-01 | 773.65 | 657.37 / exempt 37.40 / 78.88 ✓ | **Valid** | Mixed VATable + VAT-exempt lines; terse grocery line items |
| `valid-llaollao-service-invoice.jpg` | llaollao (Festival Mall) | Service Invoice | VAT · 009-229-593-00012 | 2026-04-12 | 159.00 | 141.96 / 17.04 ✓ | **Valid** | "Service Invoice" title; ink stamp and thumb over the text; values column shifted |
| `nonvat-mouthfeel.jpg` | Mouthfeel Company | Sales Invoice | **Non-VAT** · 624-464-614-000 | 2026-03-31 | 260.00 | none | **Valid spend, no input VAT**: has the "NOT VALID FOR CLAIM OF INPUT TAX" notice | Non-VAT seller; TIN wraps across lines |
| `out-of-period-jollibee-2025.jpg` | South Foodchain Group Inc (Jollibee) | "Serves as your Sales Invoice" | VAT · 753-390-697-000 | **2025-09-04** | 180.00 | 160.71 / 19.29 ✓ | **Finding: outside the Cash Advance period** | Check 6; heavy smudges and ink stains |
| `or-cebu-2022-multi-finding.jpg` | Cebu restaurant (header cut off) | **Official Receipt** | TIN not visible | **2022-03-10** | **3,113.00** | none (10% service charge) | **Multiple Findings**: Official Receipt, missing seller TIN, ≥₱1,000 without buyer details, outside the period, faded | Checks 1, 2, 3, 6, 7; worst case |
| `foreign-us-receipt.png` | East Repair Inc (US template) | "Receipt" | none, US sales tax 6.25% | 2019-02-11 | $154.06 | n/a | **Finding: not a Philippine invoice** (no TIN, USD) | Negative case; clean digital image |
| `amber-handwritten-service-invoice.jpeg` | Amber Golden Spoon Restaurant Corp | Service Invoice (handwritten) | VAT · 212-305-757-00000 | **2024-08-14** | **1,865.00** | net 1,473.21 / VAT 176.79 / exempt 215.00 ✓ | **Finding: outside the period**; handwritten amounts misread (→ VAT check flags); buyer is an individual with no TIN | Handwriting OCR; ₱1,000+ |
| `mercury-drug-730.jpeg` | Mercury Drug (Market Market) | Invoice | VAT · 000-388-474-00409 | 2026-09-19 | 730.25 | 652.01 / 78.24 ✓ | Header TIN too faded for OCR → **seller TIN NEEDS_REVIEW** (the footer POS-provider TIN is rejected by code) | Provider-TIN guard; long tape |
| `goldilocks-seller-tin-covered.jpeg` | Goldilocks Bakeshop (Festival Mall) | Sales Invoice | VAT · TIN covered by tape | 2026-08-14 | 992.00 | 885.71 / 106.29 ✓ | **Seller TIN NEEDS_REVIEW**; total misread as 952 (→ VAT check flags) | Missing TIN; OCR digit misread |
| `mercury-drug-226-faded.jpeg` | Mercury Drug (Market Market) | Invoice | VAT · 000-388-474-00409 | 2026-09-25 (faded) | 226.50 | 202.23 / 24.27 ✓ | Header TIN, date and invoice number faded → NEEDS_REVIEW (only the footer provider TIN is legible, and code rejects it) | Faded thermal footer |
| `mercury-drug-458.jpeg` | Mercury Drug (Market Market) | Invoice | VAT · 000-388-474-00409 | 2026-09-11 | 458.00 | 408.93 / 49.07 ✓ | Header TIN not read → seller TIN NEEDS_REVIEW | Crumpled tape |

## Gaps

- **No receipt of ₱1,000 or more with buyer name/TIN filled in** (check 3, positive case). Only the Official Receipt is ₱1,000 or more. Skipped for now (no physical receipts on hand); add one later, real or synthetic, with Bayanihan Demo Corp's TIN.
- No "Official Receipt" that carries the stamp. The stamp appears on the Non-VAT invoice, where it is expected.
- No Grab/taxi receipt (Petron fuel covers transport).

## Before committing (public repo)

Blur personal details in Preview (Tools → Annotate → Rectangle, filled) on:
- `or-cebu-2022-multi-finding.jpg`: cardholder name and masked card number
- `valid-landmark-vat-exempt-mix.jpg`: masked card number
- the cashier names on all receipts (optional, but consistent with a privacy-first app)

Keep seller names and TINs visible: they are public business registrations, and the checks need them.
