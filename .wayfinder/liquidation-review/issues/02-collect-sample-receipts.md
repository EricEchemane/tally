# Collect sample receipts

Type: task (HITL)
Status: resolved
Blocked by: —

## Question

What real Philippine receipts will the extraction measurement, test fixtures and demo use?

### Checklist for the user

Collect 10–15 photos (phone camera, normal lighting) into `samples/receipts/`, covering:

- [ ] 3+ VAT-registered **Invoices** with a VATable / VAT / total breakdown (restaurants, hardware, gas)
- [ ] 2+ thermal **POS / cash-register tapes** (fast food, convenience store), including at least 1 faded one
- [ ] 1+ old **"Official Receipt"**, ideally with the "NOT VALID FOR CLAIM OF INPUT TAX" stamp
- [ ] 1+ **Non-VAT** seller invoice
- [ ] 2+ receipts ≥ ₱1,000 **with buyer name/TIN filled in**, and 1 ≥ ₱1,000 **without**
- [ ] 1 deliberate **duplicate** (the same receipt photographed twice, different angle)
- [ ] 1 transport receipt (Grab / taxi / toll) if available

Add `samples/receipts/README.md` listing each file with the expected outcome (for example "valid", "Official Receipt → finding"). The demo and tests reuse these. Redact personal data as needed; keep TINs if possible (use your own Company's TIN where it appears as buyer).

Resolve by recording the file count, the gaps in coverage, and the Company name/TIN used as the demo "Company".

## Answer

- **13 receipts** in `samples/receipts/`, renamed descriptively, with expected outcomes in [README](../../../samples/receipts/README.md):
  - 8 valid VAT invoices (VAT = 12% of VATable on all)
  - 1 Non-VAT invoice
  - 2 duplicate pairs (blurry, and rotated 90°)
  - 1 out-of-period receipt (2025)
  - 1 faded 2022 Official Receipt worth ₱3,113 (multiple Findings)
  - 1 US receipt (negative case)
- **Demo Company (fictional):** Bayanihan Demo Corp, TIN 123-456-789-00000. It is fictional so no real TIN goes into the public repo.
- **Demo Cash Advance period:** 2026-03-30 to 2026-05-02.
- **Gap, accepted for now:** no ₱1,000+ invoice with buyer name/TIN (check 3 positive case). Add one later, real or synthetic.
- **Before committing:** blur card numbers, the cardholder name and cashier names (Preview). Keep seller names and TINs.
- **Hard cases for the M1 measurement:** torn header and misaligned values (Lawson), stamp over text (llaollao), rotation (Mr DIY), smudges (Jollibee), faded thermal paper (the Official Receipt).

## Comments
