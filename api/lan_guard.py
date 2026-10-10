"""Who may use the desktop backend (desktop.py only; the dev server is unchanged).

The sidecar listens on the LAN so a phone can upload receipt photos. Everything else is for the
Reviewer at this computer:
- From another device: only the phone capture page with its assets, and the photo upload with a capture
  token (routes/receipts.py checks the token against the Liquidation). Every other path is 403.
- From this computer: everything, unless the request comes from a web page on another site (an Origin
  that isn't this server) or names a Host that isn't this server, so a site open in a browser here
  can't read or change Tally's data through 127.0.0.1 (cross-site requests, DNS rebinding).
"""
import re
from urllib.parse import parse_qs, urlsplit

LOOPBACK = {"127.0.0.1", "::1", "localhost"}
_UPLOAD = re.compile(r"^/api/liquidations/\d+/receipts/?$")
_LAN_PAGES = ("/capture", "/_next/static/")
_LAN_FILES = {"/favicon.ico", "/logo.png", "/icon.png", "/apple-icon.png", "/manifest.webmanifest"}


def _host(value: str) -> str:
    """The hostname of a Host header or an Origin URL, without port or IPv6 brackets."""
    if "://" in value:
        return (urlsplit(value).hostname or "").lower()
    if value.startswith("["):
        return value[1:value.find("]")].lower()
    return value.rsplit(":", 1)[0].lower() if value.count(":") == 1 else value.lower()


def lan_allowed(method: str, path: str, query: str) -> bool:
    if method in ("GET", "HEAD") and (path.startswith(_LAN_PAGES) or path in _LAN_FILES):
        return True
    return method == "POST" and bool(_UPLOAD.match(path)) and bool(parse_qs(query).get("t", [""])[0])


class LanGuard:
    """ASGI middleware; covers HTTP and the /ws WebSocket alike."""

    def __init__(self, app, own_hosts):
        self.app = app
        self.own_hosts = own_hosts  # callable: the hostnames this server answers to (loopback + LAN IP)

    async def __call__(self, scope, receive, send):
        if scope["type"] not in ("http", "websocket"):
            return await self.app(scope, receive, send)
        headers = {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}
        client = (scope.get("client") or ("", 0))[0]
        own = {h.lower() for h in self.own_hosts()} | LOOPBACK
        method = scope.get("method", "GET")
        path, query = scope.get("path", ""), scope.get("query_string", b"").decode("latin-1")

        if _host(headers.get("host", "")) not in own:
            return await _deny(scope, send, "unknown host")
        origin = headers.get("origin")
        if origin and origin != "null" and _host(origin) not in own:
            return await _deny(scope, send, "cross-site request")
        if client not in LOOPBACK and not lan_allowed(method, path, query):
            return await _deny(scope, send, "only this computer can use Tally; phones can only send receipt photos")
        return await self.app(scope, receive, send)


async def _deny(scope, send, reason: str) -> None:
    if scope["type"] == "websocket":
        await send({"type": "websocket.close", "code": 1008})
        return
    body = ('{"detail": "%s"}' % reason).encode()
    await send({"type": "http.response.start", "status": 403,
                "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
    await send({"type": "http.response.body", "body": body})
