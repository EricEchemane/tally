"""Runtime settings, all from environment variables (see SPEC §2)."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("TALLY_DATA_DIR", ROOT / "data"))
DB_PATH = Path(os.environ.get("TALLY_DB", DATA_DIR / "tally.db"))
IMAGES_DIR = DATA_DIR / "images"

# Windows/dev: skip ocrmac + Ollama and serve committed fixtures instead.
FAKE_PIPELINE = os.environ.get("TALLY_FAKE_PIPELINE", "0") == "1"
# Multiplier for the fake pipeline's simulated OCR/LLM delays (0 in tests).
FAKE_DELAY = float(os.environ.get("TALLY_FAKE_DELAY", "1"))

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.environ.get("TALLY_MODEL", "qwen3:4b")

# Public base URL the phone uses for capture links, e.g. http://192.168.1.20:3000
WEB_URL = os.environ.get("TALLY_WEB_URL", "http://localhost:3000")
