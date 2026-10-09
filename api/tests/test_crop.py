"""Cropped Photo: corners confirmed on the phone, applied on upload (docs/adr/0001)."""
import io
import json

import pytest
from PIL import Image

from pipeline.crop import parse_corners, parse_corners_list, save_cropped
from tests.test_runner import SAMPLES, _liquidation, _wait_done

RED, WHITE = (220, 30, 30), (255, 255, 255)


def _photo(tmp_path, box=(100, 50, 300, 250), size=(400, 300), orientation=None):
    """A white photo with a red 'receipt' at `box` (in upright pixels)."""
    img = Image.new("RGB", size, WHITE)
    img.paste(RED, box)
    path = tmp_path / "photo.jpg"
    if orientation == 6:  # stored rotated, with EXIF saying "turn 90° clockwise to view"
        exif = Image.Exif()
        exif[0x0112] = 6
        img.rotate(90, expand=True).save(path, "JPEG", exif=exif)
    else:
        img.save(path, "JPEG")
    return path


def _red_share(img):
    raw = img.convert("RGB").resize((40, 40)).tobytes()
    px = [raw[i:i + 3] for i in range(0, len(raw), 3)]
    return sum(1 for r, g, b in px if r > 150 and g < 100 and b < 100) / len(px)


def test_crop_keeps_only_the_receipt(tmp_path):
    path = _photo(tmp_path)
    out = Image.open(save_cropped(path, [(0.25, 1 / 6), (0.75, 1 / 6), (0.75, 5 / 6), (0.25, 5 / 6)], tmp_path))
    assert abs(out.width - 200) <= 1 and abs(out.height - 200) <= 1
    assert _red_share(out) > 0.95


def test_crop_straightens_a_tilted_quadrilateral(tmp_path):
    path = _photo(tmp_path)
    # The receipt's corners pulled inward a little at the top, like a photo taken at an angle.
    corners = [(0.27, 0.18), (0.73, 0.18), (0.75, 5 / 6), (0.25, 5 / 6)]
    assert _red_share(Image.open(save_cropped(path, corners, tmp_path))) > 0.95


def test_corners_are_in_the_upright_photo(tmp_path):
    # Stored sideways with an EXIF orientation: the phone's corners refer to the upright view.
    path = _photo(tmp_path, orientation=6)
    out = Image.open(save_cropped(path, [(0.25, 1 / 6), (0.75, 1 / 6), (0.75, 5 / 6), (0.25, 5 / 6)], tmp_path))
    assert _red_share(out) > 0.95


@pytest.mark.parametrize("raw", [[[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [1, 1], [0, 2]],
                                 [[0, 0], [1, 0], [1, 1], ["a", 1]], [[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01]]])
def test_bad_corners_are_refused(raw):
    with pytest.raises(ValueError):
        parse_corners(raw)


def test_corners_list_needs_one_entry_per_image():
    assert parse_corners_list(None, 2) == [None, None]
    with pytest.raises(ValueError):
        parse_corners_list("[null]", 2)


def _jpeg_bytes():
    img = Image.new("RGB", (400, 300), WHITE)
    img.paste(RED, (100, 50, 300, 250))
    buf = io.BytesIO()
    img.save(buf, "JPEG")
    return buf.getvalue()


def test_upload_with_corners_stores_both_photos(client):
    lid = _liquidation(client)
    sample = (SAMPLES / "valid-bf-sinangag.jpg").read_bytes()
    files = [("images", ("a.jpg", sample, "image/jpeg")), ("images", ("b.jpg", _jpeg_bytes(), "image/jpeg"))]
    corners = [[[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.1, 0.9]], None]
    res = client.post(f"/api/liquidations/{lid}/receipts", files=files, data={"corners": json.dumps(corners)})
    assert res.status_code == 202
    cropped, whole = (_wait_done(client, x["id"]) for x in res.json())

    assert cropped["cropped_image_url"] and whole["cropped_image_url"] is None
    assert client.get(cropped["image_url"]).content == sample  # the Receipt Photo is never altered
    assert client.get(cropped["cropped_image_url"]).headers["content-type"] == "image/jpeg"
    assert client.get(f"/api/receipts/{whole['id']}/cropped-image").status_code == 404
    # The fake pipeline still finds the sample's own fixture through the Receipt Photo.
    assert cropped["derived"]["seller_tin"] == "240727673"
    thumbs = {r["id"]: r["thumbnail_url"] for r in client.get(f"/api/liquidations/{lid}").json()["receipts"]}
    assert thumbs[cropped["id"]] == cropped["cropped_image_url"] and thumbs[whole["id"]] == whole["image_url"]


def test_upload_refuses_bad_corners(client):
    lid = _liquidation(client)
    files = [("images", ("a.jpg", _jpeg_bytes(), "image/jpeg"))]
    for corners in ("[]", "[[[0,0],[1,0],[1,1]]]", "not json"):
        res = client.post(f"/api/liquidations/{lid}/receipts", files=files, data={"corners": corners})
        assert res.status_code == 422, corners
