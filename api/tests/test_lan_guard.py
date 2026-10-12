"""The desktop backend's LAN guard: other devices reach only phone capture, scoped to one Liquidation by its
capture token; nothing cross-site gets in."""
import pytest
from fastapi import FastAPI, WebSocket
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from lan_guard import COOKIE, LanGuard, lan_allowed

LAN_IP = "192.168.1.19"
TOKENS = {"tok3": 3, "tok4": 4}
RECEIPTS = {10: 3, 11: 4}  # receipt id -> liquidation id


class FakeScope:
    def liquidation_for(self, token):
        return TOKENS.get(token)

    def receipt_liquidation(self, rid):
        return RECEIPTS.get(rid)


def _app() -> FastAPI:
    app = FastAPI()

    @app.websocket("/ws")
    async def ws(socket: WebSocket):
        await socket.accept()
        try:
            await socket.receive_text()  # open until the client leaves
        except WebSocketDisconnect:
            pass

    @app.api_route("/{path:path}", methods=["GET", "POST", "DELETE"])
    def anything(path: str):
        return {"ok": path}

    app.add_middleware(LanGuard, own_hosts=lambda: {LAN_IP}, scope=FakeScope())
    return app


def _client(host: str) -> TestClient:
    base = "127.0.0.1" if host == "127.0.0.1" else LAN_IP
    return TestClient(_app(), base_url=f"http://{base}:8765", client=(host, 50000))


def test_this_computer_can_use_everything():
    c = _client("127.0.0.1")
    assert c.get("/api/liquidations").status_code == 200
    assert c.post("/api/setup/restore").status_code == 200


def test_a_phone_without_a_token_reaches_only_static_files():
    phone = _client("192.168.1.42")
    for path in ("/capture/?id=3", "/_next/static/chunks/app.js", "/vendor/opencv.js", "/edges-worker.js", "/logo.png"):
        assert phone.get(path).status_code == 200, path
    for method, path in [("GET", "/"), ("GET", "/api/liquidations"), ("GET", "/api/liquidations/3"),
                         ("GET", "/api/receipts/10"), ("POST", "/api/liquidations/3/receipts"),
                         ("GET", "/api/questions"), ("POST", "/api/setup/restore"), ("GET", "/api/setup/backup"),
                         ("DELETE", "/api/receipts/10"), ("GET", "/receipts/?id=1")]:
        assert phone.request(method, path).status_code == 403, (method, path)
    with pytest.raises(WebSocketDisconnect):
        with phone.websocket_connect("/ws", headers={"host": f"{LAN_IP}:8765"}):
            pass


def test_typing_the_address_into_a_phone_explains_what_to_do():
    phone = _client("192.168.1.42")
    r = phone.get("/", headers={"accept": "text/html,application/xhtml+xml"})
    assert r.status_code == 403 and "text/html" in r.headers["content-type"] and "QR code" in r.text
    assert phone.get("/api/liquidations", headers={"accept": "application/json"}).headers["content-type"] == "application/json"


def test_a_capture_link_opens_only_its_own_liquidation():
    phone = _client("192.168.1.42")
    page = phone.get("/capture/?id=3&t=tok3")
    assert page.status_code == 200 and f"{COOKIE}=tok3" in page.headers["set-cookie"]
    assert "HttpOnly" in page.headers["set-cookie"] and "SameSite=Strict" in page.headers["set-cookie"]
    # Later requests carry the cookie, as the page's fetches, images and WebSocket do.
    assert phone.get("/api/liquidations/3").status_code == 200
    assert phone.get("/api/receipts/10").status_code == 200
    assert phone.get("/api/receipts/10/image").status_code == 200
    assert phone.get("/api/receipts/10/cropped-image").status_code == 200
    assert phone.post("/api/liquidations/3/receipts?t=tok3").status_code == 200
    # A browser sends the page's host and cookie on the WebSocket; TestClient sends neither by itself.
    with phone.websocket_connect("/ws", headers={"host": f"{LAN_IP}:8765", "cookie": f"{COOKIE}=tok3"}):
        pass
    # Another Liquidation, its receipts, and everything else stay closed.
    assert phone.get("/api/liquidations/4").status_code == 403
    assert phone.get("/api/receipts/11").status_code == 403
    assert phone.post("/api/liquidations/4/receipts?t=tok3").status_code == 403
    assert phone.get("/api/liquidations").status_code == 403
    assert phone.delete("/api/receipts/10").status_code == 403
    assert phone.get("/api/setup/backup").status_code == 403


def test_a_wrong_token_opens_nothing():
    phone = _client("192.168.1.42")
    page = phone.get("/capture/?id=3&t=guess")
    assert page.status_code == 200 and "set-cookie" not in page.headers
    assert phone.get("/api/liquidations/3").status_code == 403
    assert phone.post("/api/liquidations/3/receipts?t=guess").status_code == 403


def test_cross_site_and_rebinding_are_refused():
    local = _client("127.0.0.1")
    assert local.get("/api/liquidations", headers={"Origin": "https://evil.example"}).status_code == 403
    assert local.get("/api/liquidations", headers={"Origin": "http://127.0.0.1:8765"}).status_code == 200
    assert local.get("/api/liquidations", headers={"Host": "evil.example:8765"}).status_code == 403


def test_lan_rules():
    rl = RECEIPTS.get
    assert lan_allowed("POST", "/api/liquidations/3/receipts", 3, rl)
    assert not lan_allowed("POST", "/api/liquidations/3/receipts", None, rl)
    assert not lan_allowed("POST", "/api/liquidations/3/receipts/../../setup/restore", 3, rl)
    assert not lan_allowed("PUT", "/capture/", 3, rl)
    assert not lan_allowed("GET", "/api/receipts/10/../../setup/backup", 3, rl)
