import os
import tempfile

import pytest

# Isolate every test run in a throwaway data dir, before config is imported.
os.environ["TALLY_DATA_DIR"] = tempfile.mkdtemp(prefix="tally-test-")
os.environ["TALLY_FAKE_PIPELINE"] = "1"
os.environ["TALLY_FAKE_DELAY"] = "0"

import config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


@pytest.fixture
def client():
    if config.DB_PATH.exists():
        config.DB_PATH.unlink()
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def clean_client(monkeypatch):
    """App with the demo Company and Cash Advance but no placeholder receipts."""
    monkeypatch.setenv("TALLY_SEED_PLACEHOLDERS", "0")
    if config.DB_PATH.exists():
        config.DB_PATH.unlink()
    with TestClient(main.app) as c:
        yield c
