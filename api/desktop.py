"""Desktop entry point: the backend as the Tauri app's sidecar (.wayfinder/desktop-app).

    uv run python desktop.py --data-dir /tmp/tally-desktop     # or the frozen build: tally-api --data-dir ...

- Binds 0.0.0.0 on the preferred port (the phone needs the LAN), falling back to any free port, then
  prints `TALLY_READY port=N` so the shell knows where to point its window.
- Exits when stdin closes: the shell holds the other end of the pipe, so a crash or force quit of the
  app still stops this process.
- Serves the dashboard (the static export of web-desktop/) at / when one is bundled or passed with --web-dir.
  The export's pages take ?id=; the API and the capture QR still write path links (/receipts/5,
  /capture/5?t=...), so those redirect here instead of changing the shared backend.
"""
import argparse
import multiprocessing
import os
import socket
import sys
import threading
import time
from pathlib import Path

PREFERRED_PORT = 8765


def lan_ip() -> str:
    """The address the phone should use. A UDP connect sends nothing; it only picks the outgoing interface."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
        except OSError:
            return "127.0.0.1"


def bind(port: int) -> socket.socket:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(("0.0.0.0", port))
    except OSError:
        sock.close()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(("0.0.0.0", 0))
    sock.listen(128)
    return sock


def bundled(*parts: str) -> Path:
    """A path inside the frozen bundle (PyInstaller's _MEIPASS) or next to this file in dev."""
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent), *parts)


def follow_network(config, port: int) -> None:
    """The QR code carries this Mac's LAN address, which changes when the Wi-Fi does (office, hotspot).
    Capture links read config.WEB_URL per request, so keeping it current is enough."""
    def loop():
        while True:
            time.sleep(5)
            config.WEB_URL = f"http://{lan_ip()}:{port}"

    threading.Thread(target=loop, daemon=True).start()


def mount_web(app, web_dir: Path) -> None:
    import mimetypes

    from fastapi import HTTPException
    from fastapi.responses import RedirectResponse
    from starlette.staticfiles import StaticFiles

    mimetypes.add_type("text/javascript", ".js")  # Windows can map .js to text/plain through the registry
    mimetypes.add_type("text/css", ".css")

    class WebFiles(StaticFiles):
        """Hashed assets cache forever; pages always revalidate, so an app update shows at once."""

        async def get_response(self, path, scope):
            if path == "api" or path.startswith("api/"):
                raise HTTPException(404)  # an unknown API path gets JSON, not the HTML 404 page
            resp = await super().get_response(path, scope)
            immutable = path.startswith("_next/static/")
            resp.headers["Cache-Control"] = "public, max-age=31536000, immutable" if immutable else "no-cache"
            return resp

    for page in ("liquidations", "receipts", "capture"):
        def redirect(item_id: int, t: str | None = None, page=page):
            return RedirectResponse(f"/{page}/?id={item_id}" + (f"&t={t}" if t else ""))
        app.add_api_route(f"/{page}/{{item_id:int}}", redirect, methods=["GET"], include_in_schema=False)

    app.mount("/", WebFiles(directory=web_dir, html=True), name="web")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", required=True)
    ap.add_argument("--port", type=int, default=PREFERRED_PORT)
    ap.add_argument("--web-dir", help="the static export of web/ (default: the bundled copy, if any)")
    a = ap.parse_args()

    sock = bind(a.port)
    port = sock.getsockname()[1]
    # config reads these at import, so they are set before the app is imported.
    os.environ["TALLY_DATA_DIR"] = a.data_dir
    os.environ.setdefault("TALLY_WEB_URL", f"http://{lan_ip()}:{port}")
    os.environ.setdefault("TALLY_SEED", "empty")  # the first-run setup fills in the Company
    Path(a.data_dir).mkdir(parents=True, exist_ok=True)

    import uvicorn

    import config
    import desktop_setup
    from main import app

    app.include_router(desktop_setup.router)
    if "TALLY_WEB_URL_FIXED" not in os.environ:
        follow_network(config, port)

    web_dir = Path(a.web_dir) if a.web_dir else bundled("web")
    if not web_dir.is_dir():
        web_dir = Path(__file__).resolve().parents[1] / "web-desktop" / "out"  # dev, after `npm run build`
    if web_dir.is_dir():
        mount_web(app, web_dir)

    server = uvicorn.Server(uvicorn.Config(app, log_level="info"))

    def exit_on_stdin_close():
        sys.stdin.read()  # returns at EOF: the shell quit or died
        server.should_exit = True
        threading.Timer(5, lambda: os._exit(0)).start()  # if graceful shutdown hangs

    if not sys.stdin.isatty():
        threading.Thread(target=exit_on_stdin_close, daemon=True).start()

    print(f"TALLY_READY port={port} url={os.environ['TALLY_WEB_URL']}", flush=True)
    server.run(sockets=[sock])


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
