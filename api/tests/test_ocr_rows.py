"""Row grouping and upright detection (SPEC §4). Pure functions: no ocrmac needed, runs on Windows."""
from pipeline.ocr import is_sideways, to_rows


def obs(text, x, y, w=0.2, h=0.02):
    return (text, 1.0, (x, y, w, h))


def test_label_and_value_on_one_row_are_joined_left_to_right():
    rows = to_rows([obs("38.04", 0.7, 0.500), obs("VAT AMOUNT", 0.1, 0.502), obs("TOTAL", 0.1, 0.45), obs("355.00", 0.7, 0.449)])
    assert rows == "VAT AMOUNT  38.04\nTOTAL  355.00"


def test_rows_are_top_to_bottom():
    assert to_rows([obs("bottom", 0.1, 0.1), obs("top", 0.1, 0.9)]) == "top\nbottom"


def test_sideways_text_has_tall_boxes():
    assert is_sideways([obs("x", 0.1, 0.1, w=0.02, h=0.2)] * 5)
    assert not is_sideways([obs("x", 0.1, 0.1)] * 5)
    assert not is_sideways([])
