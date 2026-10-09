# Expected values read by hand from samples/receipts (see its README). None = absent/unreadable on the receipt.
def r(doc, tin, br, vatreg, no, date, vatable, vat, exempt, total, notice=False, cur="PHP"):
    return dict(doc_type=doc, seller_tin9=tin, branch=br, vat_registered=vatreg, invoice_number=no, date=date,
                vatable_sales=vatable, vat_amount=vat, vat_exempt_sales=exempt, total=total,
                not_valid_for_input_tax_notice=notice, currency=cur)
TRUTH = {
 "valid-bf-sinangag": r("INVOICE","240727673","00006",True,"175026","2026-04-03",316.96,38.04,0,355.00),
 "valid-7eleven": r("INVOICE","008578970","030",True,"100237423","2026-04-21",253.57,30.43,0,284.00),
 "dup-7eleven-blurry": r("INVOICE","008578970","030",True,"100237423","2026-04-21",253.57,30.43,0,284.00),
 "valid-mrdiy-date-cropped": r("INVOICE","010057617","00144",True,"0000-0000240076",None,108.93,13.07,0,122.00),
 "dup-mrdiy-rotated": r("INVOICE","010057617","00144",True,"0000-0000240076","2026-04-12",108.93,13.07,0,122.00),
 "valid-lawson-torn": r("INVOICE","121553541","00002",True,"1005702100043415","2026-04-06",93.75,11.25,0,105.00),
 "valid-petron-fuel": r("INVOICE","007851409","0000",True,"0001362299","2026-04-03",252.63,30.32,0,282.95),
 "valid-landmark-vat-exempt-mix": r("INVOICE","009149884","000",True,"059-00-000125989","2026-05-01",657.37,78.88,37.40,773.65),
 "valid-llaollao-service-invoice": r("INVOICE","009229593","00012",True,"00002431","2026-04-12",141.96,17.04,0,159.00),
 "nonvat-mouthfeel": r("INVOICE","624464614","000",False,"064950","2026-03-31",None,None,None,260.00,notice=True),
 "out-of-period-jollibee-2025": r("INVOICE","753390697","000",True,"0600713088","2025-09-04",160.71,19.29,0,180.00),
 "or-cebu-2022-multi-finding": r("OFFICIAL_RECEIPT",None,None,None,"00038111","2022-03-10",None,None,None,3113.00),
 "foreign-us-receipt": r("OTHER",None,None,None,"US-001","2019-02-11",None,None,None,154.06,cur="USD"),
}
