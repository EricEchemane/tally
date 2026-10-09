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

**Liquidation**:
The set of receipts an employee submits to account for one cash advance, and its outcome: valid spend, disallowed spend, and amount to return.
_Avoid_: Expense report, reimbursement, claim

**Receipt**:
Any single proof-of-purchase document submitted in a liquidation, whatever its BIR document type.
_Avoid_: Document, scan, bill

**Invoice**:
The BIR document type that, under the EOPT Act, is the only primary proof of sale and the only type valid for claiming input VAT.
_Avoid_: Sales invoice (in prose), OR

**Official Receipt**:
A pre-EOPT BIR document type that is no longer valid for claiming input VAT.
_Avoid_: OR (in prose), receipt (this term is reserved for the general document)

## Review

**Check**:
One rule applied to a receipt or a liquidation, such as "buyer TIN matches the company".
_Avoid_: Validation, rule, test

**Finding**:
A problem a check raised on a specific receipt or liquidation, with its severity and the amount it affects.
_Avoid_: Issue, error, flag, warning

**Disallowed Amount**:
The part of a receipt's amount that cannot be counted as valid spend because of a finding.
_Avoid_: Rejected amount, invalid amount
