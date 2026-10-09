# Liquidation Review

A finance reviewer checks the receipts that employees submit against the cash advances they were given, and finds BIR-validity and policy problems before the liquidation is accepted.

## People

**Reviewer**:
The accountant or finance staff member who checks a liquidation and decides what is accepted, disallowed, or owed back.
_Avoid_: Admin, user, accountant (as a role name)

**Employee**:
The person who received a cash advance and must account for it with receipts.
_Avoid_: Requester, claimant

**Company**:
The registered business that issued the cash advance; its registered name, address and TIN are what a receipt's buyer details must match.
_Avoid_: Client, buyer (as a role name)

## Money and documents

**Cash Advance**:
Money given to an employee for a stated purpose and period, which must later be liquidated.
_Avoid_: CA (in prose), budget, float

**Spending Period**:
The dates a cash advance may be spent in, from its release date to its spending end date inclusive; receipts dated outside it are rejected.
_Avoid_: Coverage, validity period, date range

**Liquidation**:
The set of receipts an employee submits to account for one cash advance, and its outcome: valid spend, disallowed spend, and amount to return.
_Avoid_: Expense report, reimbursement, claim

**Approved Liquidation**:
A liquidation the Reviewer has accepted; its totals are final and it can no longer change.
_Avoid_: Closed, completed, posted

**Returned Liquidation**:
A liquidation sent back to the employee with its open findings as the reasons, to be completed and reviewed again.
_Avoid_: Rejected liquidation, declined

**Receipt**:
Any single proof-of-purchase document submitted in a liquidation, whatever its BIR document type.
_Avoid_: Document, scan, bill

**Invoice**:
The BIR document type that, under the EOPT Act, is the only primary proof of sale and the only type valid for claiming input VAT.
_Avoid_: Sales invoice (in prose), OR

**Official Receipt**:
A pre-EOPT BIR document type that is no longer valid for claiming input VAT.
_Avoid_: OR (in prose), receipt (this term is reserved for the general document)

**Particulars**:
A short description of what a receipt paid for, such as "2 rice meals" or "fuel, 2.92 L".
_Avoid_: Line items, description, items

**Expense Category**:
The kind of spending a receipt represents: meals, transport and fuel, lodging, supplies, or other.
_Avoid_: Purchase type, expense type, account

## Review

**Extraction**:
The values the app read from a receipt by itself, before any Reviewer change; kept unchanged as the record of what was read.
_Avoid_: Scan result, parse, OCR (as a name for the values)

**Correction**:
A Reviewer's replacement for one value of an extraction; where it exists, it is the value checks and exports use.
_Avoid_: Edit, override, fix

**Check**:
One rule applied to a receipt or a liquidation, such as "buyer TIN matches the company".
_Avoid_: Validation, rule, test

**Finding**:
A problem a check raised on a specific receipt or liquidation, with its severity and the amount it affects.
_Avoid_: Issue, error, flag, warning

**Severity**:
How serious a finding is: reject (the receipt's whole amount is disallowed), needs review (the Reviewer must resolve it before approval), or no input VAT (the spend counts but its VAT cannot be claimed).
_Avoid_: Level, priority, error type

**Receipt Status**:
A receipt's overall result, equal to the severity of its worst open finding, or accepted if it has none.
_Avoid_: Validity, state

**Dismissal**:
A Reviewer's decision, with a required reason, that a finding does not apply; the finding stays visible as dismissed.
_Avoid_: Override, ignore, waive

**Buyer Details Rule**:
The Company's setting for when a receipt must show the Company's name and TIN as buyer: on every receipt, or only at ₱1,000 and above (the legal minimum).
_Avoid_: Buyer threshold, TIN rule

**Disallowed Amount**:
The part of a receipt's amount that cannot be counted as valid spend because of a finding.
_Avoid_: Rejected amount, invalid amount

**Valid Spend**:
The total of a liquidation's receipts that were not rejected.
_Avoid_: Approved amount, accepted total

**Amount to Return**:
What the employee must give back: the cash advance minus the valid spend, when positive.
_Avoid_: Refund, change, balance

**Excess Spend**:
Valid spend beyond the cash advance, which the employee may claim back subject to approval.
_Avoid_: Overspend, reimbursement, negative balance

## Market

**Prospect**:
A person at a company who may adopt Tally and has sent an Early Access Request.
_Avoid_: Lead, registrant, customer, user

**Early Access Request**:
A Prospect's request to try Tally, giving their contact details, their company, and roughly how many cash advances it liquidates a month; it creates no account.
_Avoid_: Registration, sign-up, waitlist entry

**Tester**:
A person, such as a hackathon judge, who installs Tally on their own computer to try it and give feedback, without intending to adopt it.
_Avoid_: Beta user, trial user, judge (as a role name)
