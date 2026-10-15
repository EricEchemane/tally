"""Who may use the desktop backend (desktop.py only; the dev server is unchanged).

The sidecar listens on the LAN so a phone can upload receipt photos. Everything else is for the
Reviewer at this computer:
- From another device: the phone capture page and its static files, and, with a valid capture token for a
  Liquidation, just what that page needs for that Liquidation: its details, its receipts (status and
  photos), the photo upload, and live updates. Opening a capture link with its token sets a cookie holding
  the token, so the page's later requests (fetches, images, the WebSocket) carry it. Every other path is 403.
- From this computer: everything, unless the request comes from a web page on another site (an Origin
  that isn't this server) or names a Host that isn't this server, so a site open in a browser here
  can't read or change Tally's data through 127.0.0.1 (cross-site requests, DNS rebinding).
"""
import re
import sqlite3
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, urlsplit

LOOPBACK = {"127.0.0.1", "::1", "localhost"}
COOKIE = "tally_capture"
_STATIC = ("/capture", "/_next/static/", "/vendor/")
_STATIC_FILES = {"/favicon.ico", "/logo.png", "/icon.png", "/apple-icon.png", "/manifest.webmanifest",
                 "/edges-worker.js"}
_LIQUIDATION = re.compile(r"^/api/liquidations/(\d+)/?$")
_UPLOAD = re.compile(r"^/api/liquidations/(\d+)/receipts/?$")
_RECEIPT = re.compile(r"^/api/receipts/(\d+)(?:/[\w.-]+)?/?$")


def _host(value: str) -> str:
    """The hostname of a Host header or an Origin URL, without port or IPv6 brackets."""
    if "://" in value:
        return (urlsplit(value).hostname or "").lower()
    if value.startswith("["):
        return value[1:value.find("]")].lower()
    return value.rsplit(":", 1)[0].lower() if value.count(":") == 1 else value.lower()


class CaptureScope:
    """Which Liquidation a capture token opens, and which Liquidation a receipt belongs to (read-only)."""

    def __init__(self, db_path):
        self.db_path = db_path  # callable: the database file

    def _one(self, sql: str, arg) -> int | None:
        try:
            conn = sqlite3.connect(f"file:{self.db_path()}?mode=ro", uri=True, timeout=2)
            try:
                row = conn.execute(sql, (arg,)).fetchone()
            finally:
                conn.close()
        except sqlite3.Error:
            return None
        return row[0] if row else None

    def liquidation_for(self, token: str) -> int | None:
        return self._one("SELECT id FROM liquidation WHERE capture_token = ?", token) if token else None

    def receipt_liquidation(self, receipt_id: int) -> int | None:
        return self._one("SELECT liquidation_id FROM receipt WHERE id = ?", receipt_id)


def lan_allowed(method: str, path: str, liquidation_id: int | None, receipt_liquidation=lambda rid: None,
                websocket: bool = False) -> bool:
    """What another device may do. `liquidation_id` is the one its capture token opens, if any."""
    if not websocket and method in ("GET", "HEAD") and (path.startswith(_STATIC) or path in _STATIC_FILES):
        return True
    if liquidation_id is None:
        return False
    if websocket:
        return path == "/ws"
    if method == "POST" and (m := _UPLOAD.match(path)):
        return int(m.group(1)) == liquidation_id
    if method in ("GET", "HEAD"):
        if m := _LIQUIDATION.match(path):
            return int(m.group(1)) == liquidation_id
        if m := _RECEIPT.match(path):
            return receipt_liquidation(int(m.group(1))) == liquidation_id
    return False


class LanGuard:
    """ASGI middleware; covers HTTP and the /ws WebSocket alike."""

    def __init__(self, app, own_hosts, scope: CaptureScope | None = None):
        self.app = app
        self.own_hosts = own_hosts  # callable: the hostnames this server answers to (loopback + LAN IP)
        self.scope = scope

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        client = (scope.get("client") or ("", 0))[0]
        own = {h.lower() for h in self.own_hosts()} | LOOPBACK
        method = scope.get("method", "GET")
        path = scope.get("path", "")
        query = parse_qs(scope.get("query_string", b"").decode("latin-1"))

        if _host(headers.get("host", "")) not in own:
            return await _deny(scope, send, "unknown host")
        origin = headers.get("origin")
        if origin and origin != "null" and _host(origin) not in own:
            return await _deny(scope, send, "cross-site request")
        if client in LOOPBACK:
            return await self.app(scope, receive, send)

        cookie = SimpleCookie(headers.get("cookie", ""))
        token = query.get("t", [""])[0] or (cookie[COOKIE].value if COOKIE in cookie else "")
        liquidation_id = self.scope.liquidation_for(token) if self.scope else None
        receipt_liquidation = self.scope.receipt_liquidation if self.scope else (lambda rid: None)
        if not lan_allowed(method, path, liquidation_id, receipt_liquidation, scope["type"] == "websocket"):
            wants_page = scope["type"] == "http" and method == "GET" and "text/html" in headers.get("accept", "")
            return await _deny(scope, send, "only this computer can use Tally; phones can only send receipt photos",
                               page=wants_page)

        if scope["type"] == "http" and liquidation_id is not None and query.get("t") and path.startswith("/capture"):
            # The capture page's own requests (fetches, images, WebSocket, worker) can't all add ?t=.
            set_cookie = f"{COOKIE}={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200".encode("latin-1")

            async def send_with_cookie(message):
                if message["type"] == "http.response.start":
                    message = {**message, "headers": [*message.get("headers", []), (b"set-cookie", set_cookie)]}
                await send(message)

            return await self.app(scope, receive, send_with_cookie)
        return await self.app(scope, receive, send)


_PHONE_PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Tally</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;padding:2rem 1.25rem;max-width:26rem;margin-inline:auto;color:#1c1c1e}
h1{font-size:1.25rem}ol{padding-left:1.25rem}p{color:#555}</style></head><body>
<h1>This phone is connected to Tally</h1>
<p>Typing the address opens the computer's app, which only the computer can use. To send receipt photos from this phone:</p>
<ol><li>On the computer, open a Cash Advance's Liquidation in Tally.</li>
<li>Point this phone's camera at the QR code under "Scan with your phone".</li>
<li>Open the link it shows.</li></ol></body></html>"""


async def _deny(scope, send, reason: str, page: bool = False) -> None:
    if scope["type"] == "websocket":
        await send({"type": "websocket.close", "code": 1008})
        return
    if page:  # someone typed the address into a phone's browser: explain, don't show JSON
        body, kind = _PHONE_PAGE.encode(), b"text/html; charset=utf-8"
    else:
        body, kind = ('{"detail": "%s"}' % reason).encode(), b"application/json"
    await send({"type": "http.response.start", "status": 403,
                "headers": [(b"content-type", kind), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})
