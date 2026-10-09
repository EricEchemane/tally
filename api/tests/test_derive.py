"""Derived layer (SPEC §4): unit rules + a golden run over the committed real-pipeline fixtures."""
import json
from pathlib import Path

import pytest

from money import to_pesos
from pipeline.derive import (
    derive, invoice_number_from_ocr, is_provider_tin, parse_date, parse_invoice_number, parse_tin,
    repair, slsp_bucket, vat_arithmetic_ok,
)
from tests.expected import EXPECTED, SKIP

FIXTURES = Path(__file__).parent / "fixtures" / "receipts"
AMOUNTS = ("vatable_sales", "vat_amount", "vat_exempt_sales", "total")
# Faded header: OCR misread the TIN into a well-formed wrong one. Only a Reviewer can catch this.
KNOWN_SILENT_TIN_MISREADS = {"mercury-drug-226-faded"}


@pytest.mark.parametrize("raw,ocr,expected", [
    ("240-727-673-00006", "", ("240727673", "00006")),
    ("009-149-884-000", "", ("009149884", "000")),
    ("007-851-409-0000", "", ("007851409", "0000")),
    ("16062010380269830", "", (None, None)),                      # a MIN, not a TIN
    ("624-464-614-00", "", ("624464614", None)),                  # branch incomplete
    ("624-464-614-00", "TIN: 624-464-614-00\n0\nMIN: 1", ("624464614", "000")),  # wrapped branch
    (None, "", (None, None)),
])
def test_parse_tin(raw, ocr, expected):
    assert parse_tin(raw, ocr) == expected


def test_provider_tin_in_footer_is_not_the_seller():
    ocr = "\n".join(["MERCURY DRUG"] + ["item"] * 20 + ["Phillogix Systems, Inc.", "VAT REG TIN: 205-713-621-00000",
                                                         "PTU No.: FP062021", "INVOICE#1"])
    assert is_provider_tin("205-713-621-00000", ocr)
    assert not is_provider_tin("205-713-621-00000", "VAT REG TIN: 205-713-621-00000\n" + "x\n" * 20)


@pytest.mark.parametrize("raw,expected", [
    ("Fri 3 Apr 2026", "2026-04-03"), ("3:14pm, Tue 31 Mar 2026", "2026-03-31"),
    ("Apr 12, 2026 05:12 PM", "2026-04-12"), ("04/21/2026(Tue) 10:13:57", "2026-04-21"),
    ("05/01/26", "2026-05-01"), ("4/6/2026  03:22 PM", "2026-04-06"), ("09-19-26 12:47P DAEZEL.", "2026-09-19"),
    ("8.14.24", "2024-08-14"), ("2025-09-04", "2025-09-04"), ("09:00A", None), (None, None),
])
def test_parse_date(raw, expected):
    assert parse_date(raw) == expected


@pytest.mark.parametrize("raw,expected", [
    ("SI #: 00002431", "00002431"), ("8.I.# 0001362299", "0001362299"), ("INVOICE#102892612142", "102892612142"),
    ("Sales Invoice No.: 064950", "064950"), ("OR No.00038111", "00038111"), ("0000-0000240076", "0000-0000240076"),
])
def test_parse_invoice_number(raw, expected):
    assert parse_invoice_number(raw) == expected


def test_invoice_number_prefers_labelled_ocr_line():
    assert invoice_number_from_ocr("MIN: 25082009085019724\nSI No.:\n1005702100043415") == "1005702100043415"
    assert invoice_number_from_ocr("DTTRXN#: 588456\nSI Number:0600713088") == "0600713088"
    assert invoice_number_from_ocr("TXN#658707\nINVOICE#102892612142") == "102892612142"
    assert invoice_number_from_ocr("nothing here") is None


def test_vat_arithmetic_and_repair():
    good = {"vatable_sales": 31696, "vat_amount": 3804, "vat_exempt_sales": 0, "zero_rated_sales": 0, "total": 35500}
    assert vat_arithmetic_ok(good)
    # Lawson: printed values shifted one row; the LLM read VATable as 11.25.
    bad = {"vatable_sales": 1125, "vat_amount": 0, "vat_exempt_sales": 0, "zero_rated_sales": 0, "total": 10500,
           "vat_registered": True}
    assert not vat_arithmetic_ok(bad)
    fixed, repaired = repair(bad, "Sales 105.00\nPrice excl. of VAT 93.75\nNET Sales 11.25\nTotal PHP 105.00")
    assert repaired and (fixed["vatable_sales"], fixed["vat_amount"], fixed["total"]) == (9375, 1125, 10500)


def test_slsp_bucket():
    assert slsp_bucket("TRANSPORT_FUEL", "Fuel, 2.92 L", "Primera Clase Gas Station") == "OTHER_GOODS"
    assert slsp_bucket("TRANSPORT_FUEL", "Taxi fare", "Grab") == "SERVICES"
    assert slsp_bucket("MEALS", None, None) == "SERVICES"
    assert slsp_bucket("SUPPLIES", None, None) == slsp_bucket(None, None, None) == "OTHER_GOODS"


def _derived(name):
    d = FIXTURES / name
    return derive(json.loads((d / "extraction.json").read_text()), (d / "ocr.txt").read_text())


def _matches(field, got, want):
    if field in AMOUNTS:
        got = to_pesos(got)
        return (got in (None, 0) and want in (None, 0)) or (None not in (got, want) and abs(got - want) < 0.015)
    return got == want


def test_fixtures_cover_every_sample():
    samples = {p.stem for p in (FIXTURES.parents[3] / "samples" / "receipts").iterdir() if p.suffix != ".md"}
    assert samples == {p.name for p in FIXTURES.iterdir() if p.is_dir()} == set(EXPECTED)


def test_golden_accuracy_and_no_silent_errors():
    total = correct = 0
    for name, expected in EXPECTED.items():
        d = _derived(name)
        wrong = {k for k, v in expected.items() if v is not SKIP and not _matches(k, d.get(k), v)}
        total += sum(v is not SKIP for v in expected.values())
        correct += sum(v is not SKIP for v in expected.values()) - len(wrong)
        # A wrong amount on a VAT receipt must never pass the arithmetic check (it becomes NEEDS_REVIEW).
        if wrong & set(AMOUNTS) and d["vat_registered"]:
            assert not vat_arithmetic_ok(d), f"{name}: wrong amounts passed the VAT check"
        # A seller TIN is either right or absent (absent -> NEEDS_REVIEW), never silently another company's.
        if name not in KNOWN_SILENT_TIN_MISREADS and expected["seller_tin"] is not SKIP:
            assert d["seller_tin"] in (expected["seller_tin"], None), f"{name}: wrong seller TIN {d['seller_tin']}"
    assert correct / total >= 0.88, f"field accuracy {correct}/{total}"
