# Receipt extraction schema

Type: grilling (HITL)
Status: open
Blocked by: 01, 03, 04

## Question

Which fields does the app extract from each Receipt, with what types and nullability? This is the JSON Schema passed to Ollama and the shape of the stored Receipt. Which fields come from OCR + LLM, which are computed in code, and which does the Reviewer correct by hand when extraction is wrong?

It must cover what checks 1–6 need, what the Liquidation summary and the SLSP CSV need (see the SLSP purchases file format ticket), and what the M1 measurements showed the model can reliably extract.

## Comments

- From the SLSP research: the CSV needs seller TIN + branch, registered name, address, date, invoice number, net VATable amount, VAT, exempt, zero-rated, total and document type. Services/goods/capital goods is suggested by the LLM and confirmed by the Reviewer. Branch code may be 3 or 5 digits (an unverified source says RMC 36-2026 changed it), so accept both. See [findings](../research/04-slsp-format.md).
