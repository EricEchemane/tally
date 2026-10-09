"""Desktop entry point: the backend as the Tauri app's sidecar (.wayfinder/desktop-app).

    uv run python desktop.py --data-dir /tmp/tally-desktop     # or the frozen build: tally-api --data-dir ...

- Binds 0.0.0.0 on the preferred port (the phone needs the LAN), falling back to any free port, then
  prints `TALLY_READY port=N` so the shell knows where to point its window.
- Exits when stdin closes: the shell holds the other end of the pipe, so a crash or force quit of the
  app still stops this process.
- Serves the static export of web/ at / when one is bundled or passed with --web-dir.
"""
import argparse
import multiprocessing
import os
import socket
import sys
import threading
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
    os.environ.setdefault("TALLY_SEED", "minimal")  # until the first-run wizard sets up the Company
    Path(a.data_dir).mkdir(parents=True, exist_ok=True)

    import uvicorn

    from main import app

    web_dir = Path(a.web_dir) if a.web_dir else bundled("web")
    if web_dir.is_dir():
        from fastapi.staticfiles import StaticFiles

        app.mount("/", StaticFiles(directory=web_dir, html=True), name="web")

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
