# Validate the liquidation workflow with the Reviewer contact

Type: task (HITL)
Status: resolved
Blocked by: —

## Question

Does the agreed concept match how a real Reviewer handles liquidations at a Philippine company? Which parts of the workflow, checks and outputs are wrong, missing or unimportant?

The user knows an accountant at their company who handles liquidations; she may not be available. If she isn't available by the time the schema and checks tickets need answers, resolve this ticket with "unvalidated, proceed on research" and say so.

### Checklist for the user (10–15 min chat; take notes or record with permission)

1. Walk me through one liquidation, from cash advance release to closing. What's on the cash advance form (employee, amount, purpose, date range, approver)?

Liquidation is ginagawa pag meron inanvance na pera. for example meron akong cash advance advance na 15,000 for specific expense. After magamit sa purpose, tapos ang nagamit ko lang is 14,500, so meron pa akong 500 na natitira, yung 500 na natitira upon liquidation kailangan ibalik. Tapos, yung pagbalik nun ang tawag dun is liquidation, need isurrender yung 14,500 na resibo and sukli na 500 pesos para mag close yung 15K na advance. dapat valid yung receipt.

process:
- cash advance need approval before release
- on liquidation, need i-upload mga resibo
- sa encoding, eye-ball still manual,
- liquidation still needs approval, can be rejected with reasons, some receipts are not valid, dapat BIR compliant.

2. How do receipts arrive: paper pile, photos in chat, a Google Sheet? How many per liquidation, and how many liquidations per month?

- depends on company size
- physical copies are more credible, but e-invoices are also acceptable

3. What makes you reject a receipt? Rank: wrong buyer name/TIN, "Official Receipt" instead of Invoice, missing seller TIN, no VAT breakdown, faded thermal paper, outside the advance period, duplicate, policy violation (meal caps and so on).
- as is

4. Do you require Company name and TIN on every receipt or only above ₱1,000? Any company policy caps?

- Company name and TIN should be required to liquidate.
- min of 1,000. but some small companies have sales of less than 1,000 that can be consolidated.
- instance, may mga business kapag maliit yung amount, but required when customer asked to.
- kapag nag issue sila ng resibo na 100pesos lang, sayang yung invoices nila, lahat ng sales na hindi na-issuehan ng receipt, pinagsasama-sama nalang. Consolidation, only if customer didn't ask for receipt.

5. When a receipt is rejected, what happens: the Employee returns the cash, gets a replacement invoice, or it's charged to them?
- when rejected, ibabalik yung pera, (RED FLAG) when have anommalies
- instance: nagliliquidate, tapos sya pa nagfo falsify, when audited and proven, company can terminate.
- but when rejected, employee should return the money.

6. What do you produce at the end (a liquidation form, Excel, entry into an accounting system)? What columns? Can you share a blank template?
- excel and system
- TIN, date, company name, company address, particular expence, amount, with-holding tax if need, vat-amount, vat-excempt,


7. Do you also prepare input VAT / SLSP data from these receipts, or does someone else?
- kasama ng VAT filing yung SLSP

8. Is there any rule about financial or TIN data leaving the office or going to cloud tools?
- TIN or receipts are not really strict, but the consolidated/reports/SLSP is always confidential

9. If a tool did this automatically, what would you need to see to trust it?
- as long as information of the company is not compromised and publicised (PRIVACY IS THE PRIORITY)

10. Can I have 5–10 real (redacted is fine) receipts and one filled liquidation form for testing?

## Answer

**Unvalidated: proceed on research.** The user closed this before the contact was available, on 2026-10-09. The concept rests on secondary sources: tax-firm alerts, RR 7-2024 / EOPT summaries, and a published cash-advance liquidation policy. Assumptions not confirmed by a real Reviewer:

- Liquidations start from a Cash Advance record (employee, amount, purpose, period).
- Rejection reasons and their ranking (the MVP checks 1–6).
- What happens to a rejected receipt (the amount is returned by the Employee vs. a replacement invoice is requested).
- The end output (the Liquidation summary columns) and whether the same person prepares the SLSP.

If the contact becomes available later, the checklist above still applies. Her answers would mainly revise **Checks and Disallowed Amount rules** and the pitch's problem statement (25% of the score).

**Update 2026-10-09: validated after closing.** The contact answered the checklist (an accountant at the user's company who handles liquidations). The full notes were pasted in the **Receipt extraction schema** session.

Confirmed:
- **Flow:** the Cash Advance needs approval before release. At liquidation, receipts are uploaded and must be valid and BIR-compliant, and leftover cash is returned (example: ₱15,000 advanced, ₱14,500 spent, ₱500 returned). The Liquidation itself is approved or rejected with reasons.
- **Encoding is still manual ("eyeballed").** This is the pain point.
- **A rejected receipt means the Employee returns that money.** So Disallowed Amount feeds the amount to return.
- **All the proposed rejection reasons apply.** She gave no ranking.
- **Privacy:** "PRIVACY IS THE PRIORITY." Consolidated reports and the SLSP are always confidential; TINs and individual receipts are less strict.
- **Output:** Excel plus their accounting system. Columns: TIN, date, company (seller) name, company address, particulars (what the expense was), amount, withholding tax if needed, VAT amount, VAT-exempt.
- **SLSP:** prepared with the VAT filing.

Changes vs. the research:
- **Company name and TIN are required on every receipt to liquidate**, not only at ₱1,000 or more (the legal threshold). This is stricter company practice.
- **Physical receipts are more credible, but e-invoices are accepted.**
- **Red flag: falsified receipts are anomalies** that, once proven in an audit, can lead to termination. They are distinct from a simply invalid receipt.

## Comments
