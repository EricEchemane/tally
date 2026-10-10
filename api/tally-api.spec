# PyInstaller spec for the desktop sidecar: one-folder build (see .wayfinder/desktop-app/research/02-tauri-sidecar.md).
#   cd api && uv run --group desktop pyinstaller tally-api.spec --noconfirm --distpath ../desktop/dist-sidecar
# The dashboard (the static export of ../web-desktop, built first) is bundled when ../web-desktop/out exists.
import os
import sys

from PyInstaller.utils.hooks import collect_all

datas = [("db/schema.sql", "db")]
binaries = []
hiddenimports = ["pillow_heif"]

# Lazily imported, no PyInstaller hooks: Apple Vision through pyobjc (macOS) and libheif.
packages = ["pillow_heif"]
if sys.platform == "darwin":
    packages += ["objc", "Foundation", "Quartz", "Vision", "CoreML", "AppKit", "ocrmac"]
elif sys.platform == "win32":
    packages += ["rapidocr_onnxruntime", "onnxruntime"]
for pkg in packages:
    d, b, h = collect_all(pkg)
    datas, binaries, hiddenimports = datas + d, binaries + b, hiddenimports + h

if os.path.isdir("../web-desktop/out"):
    datas.append(("../web-desktop/out", "web"))

a = Analysis(["desktop.py"], pathex=["."], binaries=binaries, datas=datas, hiddenimports=hiddenimports,
             excludes=["pytest", "watchfiles", "tkinter"])
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name="tally-api", console=True)
coll = COLLECT(exe, a.binaries, a.datas, name="tally-api")
