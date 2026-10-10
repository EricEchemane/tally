"""The desktop backend's LAN guard: other devices reach only phone capture; nothing cross-site gets in."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from lan_guard import LanGuard, lan_allowed

LAN_IP = "192.168.1.19"


def _client(client_host: str) -> TestClient:
    app = FastAPI()

    @app.api_route("/{path:path}", methods=["GET", "POST", "DELETE"])
    def anything(path: str):
        return {"ok": path}

    app.add_middleware(LanGuard, own_hosts=lambda: {LAN_IP})
    return TestClient(app, base_url=f"http://{LAN_IP}:8765", client=(client_host, 50000))


def test_this_computer_can_use_everything():
    c = TestClient(_client("127.0.0.1").app, base_url="http://127.0.0.1:8765", client=("127.0.0.1", 50000))
    assert c.get("/api/liquidations").status_code == 200
    assert c.post("/api/setup/restore").status_code == 200


def test_a_phone_reaches_only_capture_and_upload():
    phone = _client("192.168.1.42")
    assert phone.get("/capture/?id=3&t=abc").status_code == 200
    assert phone.get("/capture/3").status_code == 200
    assert phone.get("/_next/static/chunks/app.js").status_code == 200
    assert phone.post("/api/liquidations/3/receipts?t=abc").status_code == 200
    for method, path in [("GET", "/"), ("GET", "/api/liquidations"), ("GET", "/api/questions"),
                         ("POST", "/api/questions"), ("GET", "/api/exports/slsp.csv"), ("POST", "/api/setup/restore"),
                         ("GET", "/api/setup/backup"), ("POST", "/api/liquidations/3/receipts"),  # no token
                         ("DELETE", "/api/receipts/1"), ("GET", "/receipts/?id=1")]:
        assert phone.request(method, path).status_code == 403, (method, path)


def test_cross_site_and_rebinding_are_refused():
    local = TestClient(_client("127.0.0.1").app, base_url="http://127.0.0.1:8765", client=("127.0.0.1", 50000))
    assert local.get("/api/liquidations", headers={"Origin": "https://evil.example"}).status_code == 403
    assert local.get("/api/liquidations", headers={"Origin": "http://127.0.0.1:8765"}).status_code == 200
    assert local.get("/api/liquidations", headers={"Host": "evil.example:8765"}).status_code == 403


def test_websocket_is_local_only():
    import pytest
    from starlette.websockets import WebSocketDisconnect

    phone = _client("192.168.1.42")
    with pytest.raises(WebSocketDisconnect):
        with phone.websocket_connect("/ws"):
            pass


def test_lan_rules():
    assert lan_allowed("POST", "/api/liquidations/12/receipts", "t=x")
    assert not lan_allowed("POST", "/api/liquidations/12/receipts", "t=")
    assert not lan_allowed("POST", "/api/liquidations/12/receipts/../../setup/restore", "t=x")
    assert not lan_allowed("PUT", "/capture/", "")
