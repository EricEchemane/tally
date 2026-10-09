import os
import tempfile

import pytest

# Isolate every test run in a throwaway data dir, before config is imported.
os.environ["TALLY_DATA_DIR"] = tempfile.mkdtemp(prefix="tally-test-")
os.environ["TALLY_FAKE_PIPELINE"] = "1"
os.environ["TALLY_FAKE_DELAY"] = "0"
os.environ["TALLY_SEED"] = "placeholders"

import config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db(monkeypatch, tmp_path):
    """A new DB file per test. Unlinking the old one fails on Windows while a connection holds it open."""
    monkeypatch.setattr(config, "DB_PATH", tmp_path / "tally.db")


@pytest.fixture
def client():
    with TestClient(main.app) as c:
        yield c


@pytest.fixture
def clean_client(monkeypatch):
    """App with the demo Company and Cash Advance but no placeholder receipts."""
    monkeypatch.setenv("TALLY_SEED", "minimal")
    with TestClient(main.app) as c:
        yield c
