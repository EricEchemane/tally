"""Store an uploaded image as a JPEG/PNG the OCR can read (SPEC §4 step 1).

The file's own bytes decide what it is, not the browser's content type: on Windows a dropped .jpg can arrive
with no type at all. JPEG and PNG are kept as they are; anything else Pillow can open (HEIC/HEIF, WebP, BMP,
GIF, TIFF...) is converted to JPEG.
"""
import hashlib
import io
import uuid
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

_registered = False


class UnsupportedImage(ValueError):
    """The bytes aren't an image this app can read."""


def _open(data: bytes) -> Image.Image:
    global _registered
    if not _registered:
        try:
            from pillow_heif import register_heif_opener

            register_heif_opener()
        except ImportError:  # HEIC just won't open; every other format still does
            pass
        _registered = True
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as e:
        raise UnsupportedImage("not an image this app can read") from e
    return img


def save_upload(data: bytes, content_type: str | None, images_dir: Path) -> tuple[Path, str]:
    """Returns (stored path, sha256 of the original bytes). The hash feeds the duplicate check.
    `content_type` is accepted for callers that have it but isn't trusted."""
    digest = hashlib.sha256(data).hexdigest()
    img = _open(data)
    images_dir.mkdir(parents=True, exist_ok=True)
    if img.format == "JPEG":
        ext = ".jpg"
    elif img.format == "PNG":
        ext = ".png"
    else:
        buf = io.BytesIO()
        ImageOps.exif_transpose(img).convert("RGB").save(buf, "JPEG", quality=92)
        data, ext = buf.getvalue(), ".jpg"
    path = images_dir / f"{uuid.uuid4().hex}{ext}"
    path.write_bytes(data)
    return path, digest
