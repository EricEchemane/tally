# SLSP purchases file format

Type: research (AFK)
Status: resolved
Blocked by: —

## Question

What exact columns and format does the BIR Summary List of Purchases (SLSP) use, so the app's "SLSP-ready purchases CSV" matches what bookkeepers import into the BIR's Reliefs tool or their accounting software? Which of those fields must the Receipt extraction capture?

## Answer

- **What BIR accepts:** only a validated RELIEF `.DAT` file, which bookkeepers produce from Excel or CSV with a converter.
- **Columns:** one row per supplier TIN per month, with seller TIN, registered name (or last/first/middle name), address, exempt, zero-rated, services, capital goods, other goods and input tax. The header also carries owner TIN, RDO, month-end, and creditable vs non-creditable input tax.
- **From the Receipt:** extraction must capture seller TIN and branch, name, address, date, invoice number, net VATable amount, VAT, exempt amount, zero-rated amount and total.
- **From context:** owner TIN, RDO and period come from the Company and Liquidation. Services vs goods vs capital goods is suggested by the LLM and confirmed by the Reviewer. Non-creditable input tax comes from Findings.
- **Export:** one CSV row per Receipt, in the vat-relief template's column order plus traceability columns.
- **Unconfirmed:** RMC 24-2002 (the official layout) wasn't retrieved, and sources conflict on whether purchases have a ₱1M threshold.

[findings](../research/04-slsp-format.md)

## Comments
