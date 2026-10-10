"""First-run setup for the desktop app (.wayfinder/desktop-app, ticket "First-run wizard and app lifecycle").

Mounted by desktop.py only, so the dev server and its tests are unchanged. The wizard in web-desktop/
(/setup/) drives these routes:

    GET  /api/setup/status            everything the wizard shows: machine, Company, Ollama, model, jobs
    POST /api/setup/company           the Company's name, TIN and Buyer Details Rule
    POST /api/setup/ollama/install    download Ollama, verify its checksum, install, start (macOS app; Windows server zip)
    POST /api/setup/ollama/start      start an installed but stopped Ollama
    POST /api/setup/model/pull        download the model with progress (resumes where it stopped)
    POST /api/setup/model/cancel
    POST /api/setup/complete          the wizard is done; the dashboard stops redirecting to it
    GET  /api/setup/backup            one .zip with the database and every receipt photo
    POST /api/setup/restore           replace everything with a backup (the current data is backed up first)
    POST /api/setup/reveal            show a downloaded file in Finder/Explorer (only files in ~/Downloads)
    GET  /api/setup/pending           how much work is still queued (the app asks before quitting)
    GET  /api/setup/firewall          Windows: whether the phone-capture firewall rule exists
    POST /api/setup/firewall          Windows: ask for administrator approval to add it again

Long jobs run in threads and report through the status route; the wizard polls it.
"""
import contextlib
import hashlib
import json
import os
import platform
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import zipfile
from pathlib import Path
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pydantic import BaseModel, Field

import config
import db
import events
import serialize
from checks import service as checks
from db import get_db

router = APIRouter(prefix="/api/setup")

APP_VERSION = "0.1.0"  # keep in step with desktop/src-tauri/tauri.conf.json
MIN_OLLAMA = (0, 12, 5)  # first release where think:false works with a JSON-schema format
MIN_RAM_GB = 8
MIN_FREE_GB = 4  # the model is 2.5 GB, written to a pre-sized file
OLLAMA_WINDOWS_GB = 2  # Tally's own Ollama: ollama-windows-amd64.zip unpacks to 1.8 GB (v0.40.2)
MIN_MACOS = 14  # the Ollama app needs Sonoma
MIN_WINDOWS_BUILD = 22000  # Windows 11; older Windows gets a warning, not a block
OLLAMA_ZIP = "https://github.com/ollama/ollama/releases/latest/download/Ollama-darwin.zip"
OLLAMA_SUMS = "https://github.com/ollama/ollama/releases/latest/download/sha256sum.txt"
# The standalone server, not OllamaSetup.exe: the installer opens Ollama's tray app and adds it to startup.
OLLAMA_WINDOWS_ZIP = "https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip"
MAC_APPS = [Path("/Applications/Ollama.app"), Path.home() / "Applications" / "Ollama.app"]
BREW_OLLAMA = [Path("/opt/homebrew/bin/ollama"), Path("/usr/local/bin/ollama")]

_lock = threading.Lock()
_jobs: dict[str, dict] = {
    "install": {"state": "idle"},  # idle | running | done | failed
    "pull": {"state": "idle"},
}
_cancel_pull = threading.Event()


def _set(job: str, **fields) -> None:
    with _lock:
        _jobs[job] = {**_jobs[job], **fields}


def _marker() -> Path:
    return config.DATA_DIR / "setup.json"


def setup_complete() -> bool:
    try:
        return json.loads(_marker().read_text()).get("complete") is True
    except (OSError, ValueError):
        return False


# --- machine


def _ram_gb() -> float:
    try:
        if sys.platform == "darwin":
            return int(subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True).stdout) / 2**30
        if sys.platform == "win32":
            import ctypes

            class MemoryStatus(ctypes.Structure):
                _fields_ = [("length", ctypes.c_ulong), ("memory_load", ctypes.c_ulong),
                           ("total_physical", ctypes.c_ulonglong), ("avail_physical", ctypes.c_ulonglong),
                           ("total_page_file", ctypes.c_ulonglong), ("avail_page_file", ctypes.c_ulonglong),
                           ("total_virtual", ctypes.c_ulonglong), ("avail_virtual", ctypes.c_ulonglong),
                           ("avail_extended_virtual", ctypes.c_ulonglong)]

            status = MemoryStatus()
            status.length = ctypes.sizeof(status)
            if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
                return 0.0
            return status.total_physical / 2**30
        return os.sysconf("SC_PAGE_SIZE") * os.sysconf("SC_PHYS_PAGES") / 2**30
    except (ValueError, OSError, AttributeError):
        return 0.0


def _macos_major() -> int | None:
    if sys.platform != "darwin":
        return None
    try:
        return int(platform.mac_ver()[0].split(".")[0])
    except ValueError:
        return None


def _windows_build() -> int | None:
    if sys.platform != "win32":
        return None
    return sys.getwindowsversion().build


def _disk() -> tuple[float, int]:
    """Free space and need on the tightest drive. The model goes where Ollama keeps models (OLLAMA_MODELS can
    point at another drive); on Windows, Tally's own Ollama goes in the data folder until one is installed."""
    def anchor(p: Path) -> str:
        existing = next((q for q in (p, *p.parents) if q.exists()), Path.home())
        return existing.anchor or str(existing)

    needs: dict[str, int] = {}
    needs[anchor(_ollama_models_dir())] = MIN_FREE_GB
    if sys.platform == "win32" and _ollama()["state"] == "missing":  # a running Ollama needs no install
        drive = anchor(config.DATA_DIR)
        needs[drive] = needs.get(drive, 0) + OLLAMA_WINDOWS_GB
    tight = min(needs, key=lambda d: shutil.disk_usage(d).free / 2**30 - needs[d])
    return shutil.disk_usage(tight).free / 2**30, needs[tight]


def _machine() -> dict:
    ram = _ram_gb()
    free, need = _disk()
    mac = _macos_major()
    build = _windows_build()
    return {"ram_gb": round(ram, 1), "ram_ok": ram >= MIN_RAM_GB - 0.5,
            "free_gb": round(free, 1), "free_needed_gb": need, "disk_ok": free >= need,
            "os": "macos" if sys.platform == "darwin" else sys.platform,
            "macos": mac, "macos_ok": mac is None or mac >= MIN_MACOS,
            "windows_build": build, "windows_ok": build is None or build >= MIN_WINDOWS_BUILD}


# --- Ollama


def _version_tuple(v: str) -> tuple[int, ...]:
    return tuple(int(x) for x in re.findall(r"\d+", v)[:3])


def _ollama_installed_path() -> Path | None:
    # Tests and UI checks can pretend nothing is installed: TALLY_OLLAMA_SEARCH="" (empty) searches nowhere.
    search = os.environ.get("TALLY_OLLAMA_SEARCH")
    if search is not None:
        places = [Path(p) for p in search.split(os.pathsep) if p]
    elif sys.platform == "win32":
        # Tally's own copy first, then one the Reviewer installed themselves (used as is).
        local = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
        places = [_tally_ollama_dir() / "ollama.exe", local / "Programs" / "Ollama" / "ollama.exe"]
        executable = shutil.which("ollama")
        if executable:
            places.append(Path(executable))
    else:
        places = MAC_APPS + BREW_OLLAMA
    for p in places:
        if p.exists():
            return p
    return None


def _tally_ollama_dir() -> Path:
    """Where Tally unpacks Ollama on Windows. The uninstaller removes this folder (desktop/src-tauri/windows/installer-hooks.nsh)."""
    return config.DATA_DIR / "ollama"


def _ollama_models_dir() -> Path:
    configured = os.environ.get("OLLAMA_MODELS")
    return Path(configured) if configured else Path.home() / ".ollama" / "models"


def _ollama() -> dict:
    try:
        version = httpx.get(f"{config.OLLAMA_URL}/api/version", timeout=1.5).json().get("version", "")
    except (httpx.HTTPError, ValueError):
        path = _ollama_installed_path()
        return {"state": "stopped" if path else "missing", "path": str(path) if path else None,
                "homebrew": bool(sys.platform == "darwin" and path and path.suffix != ".app"), "version": None}
    old = _version_tuple(version) < MIN_OLLAMA if version else False
    return {"state": "outdated" if old else "running", "version": version, "path": None, "homebrew": False}


def _model_present() -> bool:
    try:
        tags = httpx.get(f"{config.OLLAMA_URL}/api/tags", timeout=2).json().get("models", [])
    except (httpx.HTTPError, ValueError):
        return False
    return any(m.get("name") in (config.MODEL, f"{config.MODEL}:latest") for m in tags)


def _server_binary(path: Path) -> Path:
    """The Ollama server program. Ollama.app carries it inside; Homebrew's is the path itself."""
    return path / "Contents" / "Resources" / "ollama" if path.suffix == ".app" else path


def _start_ollama() -> None:
    """Start Ollama's server in the background, never its desktop app: the Reviewer only ever sees Tally.
    It runs in its own session (it outlives Tally, like a service) and logs to the data folder."""
    path = _ollama_installed_path()
    if path is None:
        raise RuntimeError("The AI engine isn't installed yet")
    log = open(config.DATA_DIR / "ollama.log", "ab")
    kwargs = {"stdin": subprocess.DEVNULL, "stdout": log, "stderr": log}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
    else:
        kwargs["start_new_session"] = True
    with _own_dlls_hidden() as env:
        subprocess.Popen([str(_server_binary(path)), "serve"], env=env, **kwargs)
    for _ in range(60):
        try:
            httpx.get(f"{config.OLLAMA_URL}/api/version", timeout=1)
            return
        except httpx.HTTPError:
            time.sleep(0.5)
    reason = _ollama_error()
    raise RuntimeError(f"The AI engine didn't start: {reason}" if reason
                       else "The AI engine didn't start. Quit Tally and open it again.")


def _ollama_error() -> str | None:
    """Ollama's own last 'Error:' line, e.g. an OLLAMA_MODELS folder it can't create."""
    try:
        lines = (config.DATA_DIR / "ollama.log").read_text(encoding="utf-8", errors="replace").splitlines()[-50:]
    except OSError:
        return None
    return next((ln.removeprefix("Error:").strip() for ln in reversed(lines) if ln.startswith("Error:")), None)


@contextlib.contextmanager
def _own_dlls_hidden():
    """Windows, frozen sidecar: PyInstaller's SetDllDirectory and PATH entry for its _internal folder are
    inherited by child processes. Ollama outlives Tally, so its llama-server would load (and lock) Tally's
    MSVCP140.dll and others, breaking updates and uninstalls. Start it with neither, then restore ours."""
    bundle = getattr(sys, "_MEIPASS", None)
    if sys.platform != "win32" or not bundle:
        yield None
        return
    import ctypes

    env = {**os.environ, "PATH": os.pathsep.join(
        p for p in os.environ.get("PATH", "").split(os.pathsep) if p and Path(p) != Path(bundle))}
    ctypes.windll.kernel32.SetDllDirectoryW(None)
    try:
        yield env
    finally:
        ctypes.windll.kernel32.SetDllDirectoryW(bundle)


def ensure_ollama_running() -> None:
    """At Tally's start: an installed but stopped Ollama is started in the background, so scanning just works."""
    if not config.FAKE_PIPELINE and _ollama()["state"] == "stopped":
        try:
            _start_ollama()
        except (RuntimeError, OSError):
            pass  # setup shows the state and offers a retry


def _install_mac() -> None:
    """What Ollama's own install.sh does on macOS, minus the CLI symlink (we only use the HTTP API)."""
    try:
        _set("install", state="running", step="Checking the download", done=0, total=0, error=None)
        sums = httpx.get(OLLAMA_SUMS, follow_redirects=True, timeout=30).text
        expected = next((ln.split()[0] for ln in sums.splitlines() if ln.strip().endswith("Ollama-darwin.zip")), None)
        if not expected:
            raise RuntimeError("Could not find the checksum for Ollama-darwin.zip")

        tmp = Path(tempfile.mkdtemp(prefix="tally-ollama-"))
        zip_path, digest = tmp / "Ollama-darwin.zip", hashlib.sha256()
        _set("install", step="Downloading Ollama")
        with httpx.stream("GET", OLLAMA_ZIP, follow_redirects=True, timeout=60) as r:
            r.raise_for_status()
            _set("install", total=int(r.headers.get("content-length", 0)))
            done = 0
            with open(zip_path, "wb") as f:
                for chunk in r.iter_bytes(1 << 20):
                    f.write(chunk)
                    digest.update(chunk)
                    done += len(chunk)
                    _set("install", done=done)
        if digest.hexdigest() != expected:
            raise RuntimeError("The Ollama download did not match its published checksum; nothing was installed")

        _set("install", step="Installing Ollama")
        # ditto keeps the app's signature and symlinks intact; zipfile would not
        subprocess.run(["ditto", "-x", "-k", str(zip_path), str(tmp)], check=True)
        target = next((d for d in MAC_APPS if os.access(d.parent, os.W_OK)), None)
        if target is None:
            raise RuntimeError("Neither /Applications nor ~/Applications is writable")
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            shutil.rmtree(target)
        shutil.move(str(tmp / "Ollama.app"), str(target))
        shutil.rmtree(tmp, ignore_errors=True)

        _set("install", step="Starting Ollama")
        _start_ollama()
        _set("install", state="done", step="Ollama is running")
    except (httpx.HTTPError, OSError, RuntimeError, subprocess.CalledProcessError, zipfile.BadZipFile) as e:
        _set("install", state="failed", error=str(e))


def _install_windows() -> None:
    """Unpack Ollama's standalone server into Tally's data folder: no installer, tray app or startup entry."""
    tmp = Path(tempfile.mkdtemp(prefix="tally-ollama-", dir=config.DATA_DIR))  # same drive as the target
    try:
        _set("install", state="running", step="Checking the download", done=0, total=0, error=None)
        sums = httpx.get(OLLAMA_SUMS, follow_redirects=True, timeout=30).text
        name = Path(OLLAMA_WINDOWS_ZIP).name
        expected = next((ln.split()[0] for ln in sums.splitlines() if ln.strip().endswith(name)), None)
        if not expected:
            raise RuntimeError(f"Could not find the checksum for {name}")

        zip_path, digest = tmp / name, hashlib.sha256()
        _set("install", step="Downloading Ollama")
        with httpx.stream("GET", OLLAMA_WINDOWS_ZIP, follow_redirects=True, timeout=60) as r:
            r.raise_for_status()
            _set("install", total=int(r.headers.get("content-length", 0)))
            done = 0
            with open(zip_path, "wb") as f:
                for chunk in r.iter_bytes(1 << 20):
                    f.write(chunk)
                    digest.update(chunk)
                    done += len(chunk)
                    _set("install", done=done)
        if digest.hexdigest() != expected:
            raise RuntimeError("The Ollama download did not match its published checksum; nothing was installed")

        _set("install", step="Installing Ollama")
        unpacked = tmp / "ollama"
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(unpacked)
        zip_path.unlink()
        target = _tally_ollama_dir()
        if target.exists():
            shutil.rmtree(target)
        unpacked.rename(target)

        _set("install", step="Starting Ollama")
        _start_ollama()
        _set("install", state="done", step="Ollama is running")
    except (httpx.HTTPError, OSError, RuntimeError, zipfile.BadZipFile) as e:
        _set("install", state="failed", error=str(e))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _pull() -> None:
    """Stream /api/pull. Closing the stream cancels; pulling again resumes from the partial files."""
    _cancel_pull.clear()
    _set("pull", state="running", status="Starting", done=0, total=0, error=None)
    try:
        with httpx.stream("POST", f"{config.OLLAMA_URL}/api/pull", json={"model": config.MODEL},
                          timeout=httpx.Timeout(30, read=120)) as r:
            r.raise_for_status()
            for line in r.iter_lines():
                if _cancel_pull.is_set():
                    _set("pull", state="idle", status="Paused")
                    return
                if not line:
                    continue
                msg = json.loads(line)
                if "error" in msg:
                    raise RuntimeError(msg["error"])
                # The weights are the one big layer; the small ones flash past.
                if msg.get("total", 0) > 100_000_000:
                    _set("pull", status="Downloading", done=msg.get("completed", 0), total=msg["total"])
                elif msg.get("status") and not msg.get("digest"):
                    _set("pull", status=msg["status"].capitalize())
        _set("pull", state="done", status="Ready") if _model_present() else \
            _set("pull", state="failed", error="The download finished but the model is not listed")
    except (httpx.HTTPError, ValueError, RuntimeError) as e:
        _set("pull", state="failed", error=str(e) or "The connection dropped. Try again: it resumes.")


def _start(job: str, target) -> None:
    with _lock:
        if _jobs[job]["state"] == "running":
            return
        _jobs[job] = {"state": "running"}
    threading.Thread(target=target, daemon=True).start()


# --- routes


@router.get("/status")
def status(conn: sqlite3.Connection = Depends(get_db)):
    company = dict(conn.execute("SELECT name, tin, buyer_details_rule FROM company WHERE id = 1").fetchone())
    ollama = _ollama()
    with _lock:
        jobs = {k: dict(v) for k, v in _jobs.items()}
    return {"complete": setup_complete(), "version": APP_VERSION, "data_dir": str(config.DATA_DIR),
            "machine": _machine(), "company": company,
            "company_ok": bool(company["name"] and len(company["tin"]) >= 9),
            "ollama": ollama, "model": {"name": config.MODEL, "present": ollama["state"] == "running" and _model_present()},
            "install": jobs["install"], "pull": jobs["pull"]}


class CompanyIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    tin: str
    buyer_details_rule: Literal["ALL_RECEIPTS", "AT_1000_AND_ABOVE"] = "ALL_RECEIPTS"


@router.post("/company")
def set_company(body: CompanyIn, conn: sqlite3.Connection = Depends(get_db)):
    tin = re.sub(r"\D", "", body.tin)
    if len(tin) not in (9, 12, 13, 14):
        raise HTTPException(422, "Enter the Company's TIN: 9 digits, plus the branch code if you have it")
    conn.execute("UPDATE company SET name = ?, tin = ?, buyer_details_rule = ? WHERE id = 1",
                 (body.name.strip(), tin, body.buyer_details_rule))
    conn.commit()
    events.publish("company.updated", buyer_details_rule=body.buyer_details_rule)
    checks.recheck_open(conn)
    return {"name": body.name.strip(), "tin": tin, "buyer_details_rule": body.buyer_details_rule}


@router.post("/ollama/install", status_code=202)
def install_ollama():
    if _ollama()["state"] == "running":
        return {"state": "done"}
    if sys.platform == "darwin":
        _start("install", _install_mac)
    elif sys.platform == "win32":
        _start("install", _install_windows)
    else:
        raise HTTPException(501, "Automatic setup is available on macOS and Windows only")
    return {"state": "running"}


@router.post("/ollama/start")
def start_ollama():
    try:
        _start_ollama()
    except (RuntimeError, OSError, subprocess.CalledProcessError) as e:
        raise HTTPException(409, str(e)) from e
    return {"state": "running"}


@router.post("/model/pull", status_code=202)
def pull_model():
    if _ollama()["state"] != "running":
        raise HTTPException(409, "Ollama is not running")
    _start("pull", _pull)
    return {"state": "running"}


@router.post("/model/cancel")
def cancel_pull():
    _cancel_pull.set()
    return {"state": "cancelling"}


@router.post("/complete")
def complete(conn: sqlite3.Connection = Depends(get_db)):
    if not status(conn)["company_ok"]:
        raise HTTPException(409, "Set up the Company first")
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    _marker().write_text(json.dumps({"complete": True, "at": time.strftime("%Y-%m-%dT%H:%M:%S")}))
    return {"complete": True}


# --- back up and restore


def write_backup(conn: sqlite3.Connection, out: Path) -> Path:
    """The database (a consistent copy, even while the app runs) plus every receipt photo."""
    with tempfile.TemporaryDirectory() as tmp:
        snapshot = Path(tmp) / "tally.db"
        dest = sqlite3.connect(snapshot)
        conn.backup(dest)
        dest.close()
        with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("manifest.json", json.dumps({"app": "tally", "version": APP_VERSION,
                                                    "created_at": time.strftime("%Y-%m-%dT%H:%M:%S")}))
            z.write(snapshot, "tally.db")
            for photo, cropped in conn.execute("SELECT image_path, cropped_path FROM receipt"):
                for path in (photo, cropped):
                    if path and Path(path).exists():
                        z.write(path, f"images/{Path(path).name}")
    return out


@router.get("/backup")
def backup(conn: sqlite3.Connection = Depends(get_db)):
    tmp = Path(tempfile.mkdtemp(prefix="tally-backup-"))
    out = write_backup(conn, tmp / f"tally-backup-{time.strftime('%Y-%m-%d')}.zip")
    return FileResponse(out, filename=out.name, media_type="application/zip",
                        background=BackgroundTask(shutil.rmtree, tmp, ignore_errors=True))


def _redacted_log(path: Path) -> str:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")[-1_000_000:]
    except OSError:
        return ""
    return text.replace(str(config.DATA_DIR), "<data-dir>").replace(str(Path.home()), "<home>")


@router.get("/diagnostics")
def diagnostics():
    """A user-controlled support bundle. Financial data and receipt images never enter this archive."""
    tmp = Path(tempfile.mkdtemp(prefix="tally-diagnostics-"))
    out = tmp / f"tally-diagnostics-{time.strftime('%Y-%m-%d')}.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("system.json", json.dumps({
            "app": "tally", "version": APP_VERSION, "platform": sys.platform,
            "python": platform.python_version(), "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        }, indent=2))
        for source, name in ((config.LOG_DIR / "tally-api.log", "logs/tally-api.log"),
                             (config.DATA_DIR / "ollama.log", "logs/ollama.log")):
            text = _redacted_log(source)
            if text:
                z.writestr(name, text)
    return FileResponse(out, filename=out.name, media_type="application/zip",
                        background=BackgroundTask(shutil.rmtree, tmp, ignore_errors=True))


@router.post("/restore")
async def restore(file: UploadFile = File(...), conn: sqlite3.Connection = Depends(get_db)):
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "backup.zip"
        src.write_bytes(await file.read())
        try:
            with zipfile.ZipFile(src) as z:
                manifest = json.loads(z.read("manifest.json"))
                if manifest.get("app") != "tally" or "tally.db" not in z.namelist():
                    raise ValueError
                z.extractall(Path(tmp) / "x")
        except (zipfile.BadZipFile, KeyError, ValueError):
            raise HTTPException(422, "This file isn't a Tally backup") from None
        restored = sqlite3.connect(Path(tmp) / "x" / "tally.db")
        try:
            restored.execute("SELECT COUNT(*) FROM company").fetchone()
        except sqlite3.DatabaseError:
            raise HTTPException(422, "The backup's database is damaged") from None

        # Safety net: the data being replaced goes into a backup of its own first.
        safety = config.DATA_DIR / "backups"
        safety.mkdir(parents=True, exist_ok=True)
        write_backup(conn, safety / f"before-restore-{time.strftime('%Y-%m-%d-%H%M%S')}.zip")

        # Photos land in this computer's images folder; their paths are rewritten to match.
        config.IMAGES_DIR.mkdir(parents=True, exist_ok=True)
        for img in (Path(tmp) / "x" / "images").glob("*") if (Path(tmp) / "x" / "images").exists() else []:
            shutil.copy2(img, config.IMAGES_DIR / img.name)
        def here(path):
            return str(config.IMAGES_DIR / Path(path).name)

        for rid, path in restored.execute("SELECT id, image_path FROM receipt").fetchall():
            restored.execute("UPDATE receipt SET image_path = ? WHERE id = ?", (here(path), rid))
        if "cropped_path" in {c[1] for c in restored.execute("PRAGMA table_info(receipt)")}:  # older backups lack it
            for rid, path in restored.execute("SELECT id, cropped_path FROM receipt WHERE cropped_path IS NOT NULL").fetchall():
                restored.execute("UPDATE receipt SET cropped_path = ? WHERE id = ?", (here(path), rid))
        restored.commit()
        restored.backup(conn)  # page-by-page copy into the live database
        restored.close()
    db.init_db(conn)  # a backup from an older version gets the newer columns
    checks.recheck_open(conn, publish=False)
    events.publish("company.updated", buyer_details_rule=conn.execute("SELECT buyer_details_rule FROM company").fetchone()[0])
    for (lid,) in conn.execute("SELECT id FROM liquidation"):
        events.publish("liquidation.updated", liquidation_id=lid, status=conn.execute(
            "SELECT status FROM liquidation WHERE id = ?", (lid,)).fetchone()[0], totals=serialize.totals(conn, lid))
    return {"restored": True, "from_version": manifest.get("version"), "created_at": manifest.get("created_at")}


class RevealIn(BaseModel):
    path: str


@router.post("/reveal", status_code=204)
def reveal(body: RevealIn):
    """Show in Finder for the download toast. Limited to ~/Downloads: the page can't point it anywhere else."""
    downloads = (Path.home() / "Downloads").resolve()
    target = Path(body.path).resolve()
    if downloads not in target.parents or not target.is_file():
        raise HTTPException(404, "file not found in Downloads")
    if sys.platform == "darwin":
        subprocess.run(["open", "-R", str(target)], check=False)
    elif sys.platform == "win32":
        subprocess.run(["explorer", "/select,", str(target)], check=False)


FIREWALL_RULE = "Tally phone capture"  # the installer adds it too (desktop/src-tauri/windows/installer-hooks.nsh)


def _firewall_rule_present() -> bool:
    # Reading rules needs no elevation; netsh exits non-zero when no rule has this name.
    check = subprocess.run(["netsh", "advfirewall", "firewall", "show", "rule", f"name={FIREWALL_RULE}"],
                           capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, check=False)
    return check.returncode == 0


def _public_network() -> bool:
    """The rule covers Private networks only, so on a network Windows calls Public the phone can't connect."""
    check = subprocess.run(["powershell.exe", "-NoProfile", "-Command",
                            "(Get-NetConnectionProfile | Where-Object IPv4Connectivity -ne 'Disconnected').NetworkCategory"],
                           capture_output=True, text=True, creationflags=subprocess.CREATE_NO_WINDOW, check=False)
    categories = check.stdout.split()
    return bool(categories) and "Private" not in categories and "DomainAuthenticated" not in categories


@router.get("/firewall")
def firewall():
    """Phone capture on Windows needs the allow rule (missing if the installer's prompt was declined) and a
    network Windows treats as Private."""
    if sys.platform != "win32":
        return {"applies": False, "allowed": True, "public_network": False}
    return {"applies": True, "allowed": _firewall_rule_present(), "public_network": _public_network()}


@router.post("/firewall")
def allow_firewall():
    """Ask Windows for administrator approval (UAC) to add the rule for this sidecar, Private networks only."""
    if sys.platform != "win32":
        return {"applies": False, "allowed": True}
    program = sys.executable.replace("'", "''")  # the frozen tally-api.exe
    args = (f'advfirewall firewall add rule name="{FIREWALL_RULE}" dir=in action=allow '
            f'program="{program}" enable=yes profile=private')
    subprocess.run(["powershell.exe", "-NoProfile", "-Command",
                    f"Start-Process netsh -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '{args}'"],
                   capture_output=True, creationflags=subprocess.CREATE_NO_WINDOW, check=False)
    return {"applies": True, "allowed": _firewall_rule_present(), "public_network": _public_network()}


@router.get("/pending")
def pending():
    """Fast and local (unlike /api/health, which also asks Ollama and can be slow while the model works)."""
    from pipeline import runner

    return {"length": runner.queue_state()["length"]}
