"""Store an uploaded image as a JPEG/PNG the OCR can read; HEIC is converted (SPEC §4 step 1)."""
import hashlib
import io
import uuid
from pathlib import Path

from PIL import Image

HEIC_TYPES = {"image/heic", "image/heif"}


def save_upload(data: bytes, content_type: str, images_dir: Path) -> tuple[Path, str]:
    """Returns (stored path, sha256 of the original bytes). The hash feeds the duplicate check."""
    digest = hashlib.sha256(data).hexdigest()
    images_dir.mkdir(parents=True, exist_ok=True)
    if content_type in HEIC_TYPES:
        from pillow_heif import register_heif_opener

        register_heif_opener()
        buf = io.BytesIO()
        Image.open(io.BytesIO(data)).convert("RGB").save(buf, "JPEG", quality=92)
        data, ext = buf.getvalue(), ".jpg"
    else:
        ext = ".png" if content_type == "image/png" else ".jpg"
    path = images_dir / f"{uuid.uuid4().hex}{ext}"
    path.write_bytes(data)
    return path, digest
