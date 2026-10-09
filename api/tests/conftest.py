import os
import tempfile

import pytest

# Isolate every test run in a throwaway data dir, before config is imported.
os.environ["TALLY_DATA_DIR"] = tempfile.mkdtemp(prefix="tally-test-")
os.environ["TALLY_FAKE_PIPELINE"] = "1"

import config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402


@pytest.fixture
def client():
    if config.DB_PATH.exists():
        config.DB_PATH.unlink()
    with TestClient(main.app) as c:
        yield c
