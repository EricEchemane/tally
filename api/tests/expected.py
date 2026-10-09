"""Ground truth read by hand from samples/receipts (see its README). Pesos. SKIP = unreadable even to a human."""
SKIP = object()


def r(doc, tin, br, vatreg, no, date, vatable, vat, exempt, total, notice=False, cur="PHP"):
    return dict(doc_type=doc, seller_tin=tin, seller_branch=br, vat_registered=vatreg, invoice_number=no,
                date=date, vatable_sales=vatable, vat_amount=vat, vat_exempt_sales=exempt, total=total,
                not_valid_notice=notice, currency=cur)


EXPECTED = {
    "valid-bf-sinangag": r("INVOICE", "240727673", "00006", True, "175026", "2026-04-03", 316.96, 38.04, 0, 355.00),
    "valid-7eleven": r("INVOICE", "008578970", "030", True, "100237423", "2026-04-21", 253.57, 30.43, 0, 284.00),
    "dup-7eleven-blurry": r("INVOICE", "008578970", "030", True, "100237423", "2026-04-21", 253.57, 30.43, 0, 284.00),
    "valid-mrdiy-date-cropped": r("INVOICE", "010057617", "00144", True, "0000-0000240076", None, 108.93, 13.07, 0, 122.00),
    "dup-mrdiy-rotated": r("INVOICE", "010057617", "00144", True, "0000-0000240076", "2026-04-12", 108.93, 13.07, 0, 122.00),
    "valid-lawson-torn": r("INVOICE", "121553541", "00002", True, "1005702100043415", "2026-04-06", 93.75, 11.25, 0, 105.00),
    # OCR misses the curved "SALES INVOICE" title, so doc_type is None -> NEEDS_REVIEW by design.
    "valid-petron-fuel": r(None, "007851409", "0000", True, "0001362299", "2026-04-03", 252.63, 30.32, 0, 282.95),
    "valid-landmark-vat-exempt-mix": r("INVOICE", "009149884", "000", True, "059-00-000125989", "2026-05-01", 657.37, 78.88, 37.40, 773.65),
    "valid-llaollao-service-invoice": r("INVOICE", "009229593", "00012", True, "00002431", "2026-04-12", 141.96, 17.04, 0, 159.00),
    "nonvat-mouthfeel": r("INVOICE", "624464614", "000", False, "064950", "2026-03-31", None, None, 0, 260.00, notice=True),
    "out-of-period-jollibee-2025": r("INVOICE", "753390697", "000", True, "0600713088", "2025-09-04", 160.71, 19.29, 0, 180.00),
    "or-cebu-2022-multi-finding": r("OFFICIAL_RECEIPT", None, None, SKIP, "00038111", "2022-03-10", SKIP, SKIP, SKIP, 3113.00),
    "foreign-us-receipt": r("OTHER", None, None, SKIP, "US-001", "2019-02-11", SKIP, SKIP, SKIP, 154.06, cur="USD"),
    "amber-handwritten-service-invoice": r("INVOICE", "212305757", "00000", True, "144254", "2024-08-14", 1473.21, 176.79, 215.00, 1865.00),
    "mercury-drug-730": r("INVOICE", "000388474", "00409", True, "102892612142", "2026-09-19", 652.01, 78.24, 0, 730.25),
    "goldilocks-seller-tin-covered": r("INVOICE", None, None, True, "02-00032921", "2026-08-14", 885.71, 106.29, 0, 992.00),
    "mercury-drug-226-faded": r("INVOICE", "000388474", "00409", True, SKIP, "2026-09-25", 202.23, 24.27, 0, 226.50),
    "mercury-drug-458": r("INVOICE", "000388474", "00409", True, "102895595543", "2026-09-11", 408.93, 49.07, 0, 458.00),
}
