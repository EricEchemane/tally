# SLSP purchases file format: findings

## What it is

The Summary List of Purchases (SLP) is the purchases half of the BIR's Summary List of Sales and Purchases (SLSP). The BIR's RELIEF (Reconciliation of Listings for Enforcement) system uses it to cross-match a buyer's input VAT against what each supplier declared. The BIR only accepts a **validated .DAT file** produced by the BIR RELIEF Data Entry and Validation Module or by CAS-ready software. That file is zipped and emailed to esubmission@bir.gov.ph or uploaded through eFPS. Excel and CSV files are only inputs to a converter. [ledgerq](https://ledgerq.cloud/blog/bir-relief-dat-file-slsp-guide), [invoicedataextraction](https://invoicedataextraction.com/blog/prepare-slsp-from-invoices-bir-2550q)

## Purchases columns (one row per supplier TIN per month)

Seller TIN, registered name (for a business) **or** last/first/middle name (for an individual), address, **exempt**, **zero-rated**, **purchases of services**, **purchases of capital goods**, **purchases of goods other than capital goods** (the last three are VAT-taxable amounts, net of VAT), and **input tax**. The file-level header also splits input tax into creditable and non-creditable.

## .DAT layout (confirmed from open-source generators, not from the BIR spec)

The format is comma-separated, with text in double quotes, amounts in plain decimals with no thousands separator, and Windows-1252 encoding. There is one file per month, named `<ownerTIN9>P<MM><YYYY>.DAT`. The cpa-coder `vat-relief` generator ([DatFileGenerator.cs](https://github.com/cpa-coder/vat-relief)) writes:

```
H,P,"<ownerTIN>","<regName>","<last>","<first>","<middle>","<tradeName>","<street>","<city>",exempt,zeroRated,services,capitalGoods,otherGoods,inputTax,creditableInputTax,nonCreditableInputTax,<RDO>,<MM/DD/YYYY month-end>,<fiscal year-end month>
D,P,"<supplierTIN9>","<regName>","<last>","<first>","<middle>","<street>","<city>",exempt,zeroRated,services,capitalGoods,otherGoods,inputTax,<ownerTIN9>,<MM/DD/YYYY month-end>
```

- Detail rows are grouped by supplier TIN and sorted by name.
- The TIN is cut to **9 digits** in the detail row, so the branch code is dropped.
- A second PHP exporter shows the same `H,P` / `D,P` record codes ([kyccej12/eccdi-erp](https://github.com/kyccej12/eccdi-erp)).
- The official layout is prescribed by **RMC 24-2002**. **I could not retrieve that document**, so field order should be checked against the RELIEF Validation Module before anything is filed.

## Common Excel import templates

- **bir-excel-uploader RELIEF Purchases template:** I downloaded and read [the template](https://bir-excel-uploader.com/xlsfiles/Relief_Purchases_Template.xls). Its sheet `R_Purchases` has the columns `Vendor_TIN, companyName, lastName, firstName, middleName, address1, address2, exempt, zeroRated, services, capitalGoods, otherThancapitalGoods, taxableNetofVat, vatRate, inputVat, totalPurchases`. TINs are entered with no hyphens, and negative values use a minus sign, not parentheses ([rules](https://bir-excel-uploader.com/excel-file-to-bir-dat-format/)).
- **cpa-coder `vat-relief`:** its PURCHASES sheet has the columns MONTH_END (A), TIN (B), REG NAME, LAST, FIRST, MIDDLE, street, city, EXEMPT (I), ZERO_RATED (J), SERVICE (K), capital goods, other goods, input tax and non-creditable.
- **Odoo:** exports SLP as XLSX only and says it "cannot generate the DAT files directly". Its TIN format is `NNN-NNN-NNN-NNNNN`, with branch code `00000` by default ([Odoo docs](https://www.odoo.com/documentation/17.0/applications/finance/fiscal_localizations/philippines.html)).

## Who files, how often, and what changed

- **Who:** VAT-registered taxpayers, as an attachment to the quarterly 2550Q. Commonly cited as RR 1-2012.
- **Purchases threshold: sources conflict.** One source says the SLP is needed only above ₱1M in quarterly purchases ([ledgerq](https://ledgerq.cloud/blog/bir-relief-dat-file-slsp-guide)). Another says there is no threshold ([invoicedataextraction](https://invoicedataextraction.com/blog/prepare-slsp-from-invoices-bir-2550q)). **Unconfirmed.**
- **Deadline:** the 25th day after the quarter ends, quarterly with monthly breakdown files. A nil quarter is still submitted.
- **2024–2026:**
  - I found **no issuance that changes the SLP columns.**
  - EOPT / RR 7-2024 changes the *evidence*: only an Invoice supports input VAT, so a purchase backed only by an Official Receipt belongs in non-creditable input tax.
  - The monthly 2550M has been optional since 2023.
  - One secondary blog says RMC 36-2026 widened the eBIRForms branch code from 3 to 5 digits. **Not verified against the RMC.**
- The e-invoicing (EIS) deadline of Dec 31, 2026 is a separate system from SLSP.

## Which fields come from where

**From the Receipt (the extraction must capture these):**

- Seller TIN (9 digits) and branch code (5 digits)
- Seller registered name, or last/first/middle name if the seller is an individual
- Seller address
- Invoice date (this decides the month)
- Invoice number (for the audit trail)
- VATable sales (net), VAT amount, VAT-exempt amount, zero-rated amount, and total
- Document type (Invoice or Official Receipt)
- Item description, used to *suggest* services, capital goods or other goods

**From the Company / Liquidation context:**

- Owner TIN and branch, registered name, trade name, address, RDO, and fiscal year-end month. These belong on Company.
- Month-end and quarter, derived from the Receipt date.
- Services / capital goods / other-goods classification. The LLM suggests it and the Reviewer confirms it.
- Non-creditable input tax, derived from Findings. Examples: an Official Receipt, a missing or mismatched buyer TIN, or an amount the Reviewer disallowed.

## Recommended "SLSP-ready purchases CSV" columns

One row per Receipt that passes the checks, not aggregated, so the bookkeeper's converter can group by TIN and month. Amounts use 2 decimals and no separators. TINs and dates are text. The order mirrors the `vat-relief` template so the file pastes straight into it:

```
month_end,seller_tin,seller_branch_code,registered_name,last_name,first_name,middle_name,address1,address2,exempt,zero_rated,services,capital_goods,other_goods,taxable_net_of_vat,input_tax,non_creditable_input_tax,gross_purchases,invoice_no,invoice_date,owner_tin,liquidation_id,receipt_id
```

- `month_end` is in `MM/DD/YYYY` format.
- `seller_tin` is 9 digits with no hyphens.
- `taxable_net_of_vat` equals services + capital_goods + other_goods.
- The last five columns are for traceability. A converter ignores them.
