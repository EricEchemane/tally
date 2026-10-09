# Checks and Disallowed Amount rules

Type: grilling (HITL)
Status: open
Blocked by: 01, 05

## Question

For each MVP check (1–6), decide:
- its exact rule over the extracted Receipt fields
- the severity of the Finding it raises (blocks the whole amount, blocks the input VAT only, or a warning)
- how it changes the Disallowed Amount
- how the Liquidation totals (valid spend, Disallowed Amount, amount to return) are computed from the Findings

It also covers edge cases: Non-VAT sellers, receipts under ₱1,000, missing fields because OCR failed rather than the Receipt being defective, and the Reviewer overriding a Finding.

## Comments

- From Collect sample receipts: there is no ₱1,000+ invoice with buyer name/TIN yet, so check 3's passing case has no fixture. Decide whether a synthetic one (Bayanihan Demo Corp TIN) is acceptable for tests and the demo.
