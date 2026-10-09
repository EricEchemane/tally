# Tauri with a Python sidecar: findings

Ticket: [02 — Tauri with a Python sidecar](../issues/02-tauri-python-sidecar-packaging.md). Researched 2026-10-09.

Tags: **[official]** = read in the vendor's own docs or source (Tauri docs/source, PyInstaller docs, Apple/Microsoft/GitHub docs). **[secondary]** = blog, forum, example repo or GitHub issue. **[estimate]** = my own arithmetic, not measured on a build.

## Summary and recommendation

**Tauri 2 works for this.** Its docs name "Python CLI applications or API servers bundled using `pyinstaller`" as the standard use for a sidecar. Recommended setup:

1. **Freeze with PyInstaller in `--onedir` mode, built on each OS's own CI runner.** Do not use `--onefile`. Onefile adds a bootloader parent process: Tauri's `kill()` stops only that parent, so the real server is orphaned. Onefile also unpacks itself to a temp folder on every launch, which is slower and looks to antivirus like a malware packer. PyInstaller already has hooks for `uvicorn` and `openpyxl`. `pyobjc`/`ocrmac` and `pillow-heif` have no hooks and will need `--collect-all`. Use Nuitka only if PyInstaller fails: it is slower to build and its pyobjc support is thinly documented.
2. **Spawn the server from Rust in `setup()`, not from JavaScript.** Pass the data folder and LAN URL as environment variables. The sidecar binds `0.0.0.0` on a preferred port, falling back to any free port, then prints `TALLY_READY port=NNNN` to stdout. Rust waits for that line and a `200` from `GET /health`, then opens the window with `WebviewUrl::External("http://127.0.0.1:NNNN")`. A small bundled splash page shows until then.
3. **Stop the server in three layers:**
   - On `RunEvent::Exit`, ask the server to shut down, then kill it.
   - The server exits when its stdin closes. Tauri already pipes stdin, and the pipe closes even if Tauri crashes, on both OSes.
   - On the next start, clean up any leftover server using a PID file that records the image name.
4. **The window needs no Tauri IPC at all.** The page is plain HTTP plus WebSocket to 127.0.0.1, and both WKWebView and WebView2 handle that. Tauri gives remote-URL pages no IPC by default, which is safer. If the Ollama setup dialog needs native calls, add a `remote` capability.
5. **CI builds both platforms:**
   - A `tauri-action` matrix runs `macos-latest` (arm64) and `windows-latest` (x64).
   - Each job first builds the PyInstaller sidecar on its own runner, because PyInstaller cannot cross-compile.
   - Sign macOS builds ad-hoc (`"signingIdentity": "-"`) so Apple Silicon doesn't report them as "damaged".
6. **Biggest pilot risks are Windows, not Tauri:**
   - **Firewall:** a user without admin rights gets a firewall prompt, and Windows creates a **block** rule whatever they click. Phone capture is then dead until someone deletes that rule.
   - **Smart App Control:** where it is on, Windows 11 blocks unsigned apps with **no per-app override**.
   - On macOS, users get past Gatekeeper with System Settings → Privacy & Security → **Open Anyway**. Control-click → Open no longer works since Sequoia.

**Size and cold start:** no source has published figures for this exact stack.
- **Size [estimate]:** about 80–110 MB installed and 30–45 MB as a compressed DMG or NSIS installer (method in §1).
- **Cold start:** the only data point is a Tauri + PyInstaller app that started in about 2 s normally, but took 45 s on the first launch of a DMG built in CI. A maintainer suspects macOS malware scanning; the cause is unconfirmed. **Measure this in the prototype.**

---

## 1. Freezing the backend

### Options

| Tool | Fits Tauri? | Notes |
|---|---|---|
| **PyInstaller `--onedir`** (recommended) | Yes, shipped through `bundle.resources` and started from Rust by absolute path (see §2) | One process. Nothing unpacks at launch. Mature hooks. |
| PyInstaller `--onefile` | Yes, the officially documented `externalBin` route | Bootloader parent plus Python child: `kill()` orphans the server (see §2). Unpacks to a temp folder every launch. More antivirus hits. Leaves `_MEI*` temp folders behind after a force quit. |
| Nuitka `--standalone` / `--onefile` | Yes | Compiles to C. Long builds: about 4 min cold in one Tauri template. pyobjc is supported only from pyobjc 9.0. Sparse documentation for uvicorn and FastAPI. |
| python-build-standalone plus a uv-installed venv in `resources` | Yes (you write your own launcher) | No freezing, so no hidden-import problems. Ships a larger file tree. Nobody has documented doing this with Tauri. Fallback if freezing fights pyobjc. |

- **[official]** The [Tauri sidecar docs](https://v2.tauri.app/develop/sidecar/) say: "Common use cases are Python CLI applications or API servers bundled using `pyinstaller`."
- **[official]** `externalBin` takes **one executable per entry**, named with a `-$TARGET_TRIPLE` suffix such as `tally-api-aarch64-apple-darwin` or `tally-api-x86_64-pc-windows-msvc.exe`. An onedir folder does not fit there, which is why onedir goes in `bundle.resources` instead.
- **[official]** [PyInstaller operating modes](https://pyinstaller.org/en/stable/operating-mode.html):
  - "The output of PyInstaller is specific to the active operating system and the active version of Python." Each OS must build its own.
  - Onefile "creates a temporary folder" at every start, so it "is a little slower to start than a one-folder app".
  - Onefile leaves that temp folder behind after "Force Quit".
- **[official]** [PyInstaller pitfalls](https://pyinstaller.org/en/stable/common-issues-and-pitfalls.html): call `multiprocessing.freeze_support()` first thing if anything uses multiprocessing. Leaving it out causes "an endless spawn loop".
- **[official]** Nuitka's [release notes](https://nuitka.net/posts/nuitka-release-08.html) say pyobjc is supported only from pyobjc 9.0, and that a "newer uvicorn" was added. **[secondary]** The [matshoppenbrouwers/tauri-python-sidecar](https://github.com/matshoppenbrouwers/tauri-python-sidecar) template uses Nuitka on Windows; its README reports about 4 min cold builds and a fix that cut build memory from 14 GB to 2 GB with `--nofollow-import-to`.

### Known problems with our dependencies

- **uvicorn.** **[official]** pyinstaller-hooks-contrib ships [`hook-uvicorn.py`](https://github.com/pyinstaller/pyinstaller-hooks-contrib/tree/master/_pyinstaller_hooks_contrib/stdhooks), which is `collect_submodules('uvicorn')`. Hooks for `uvloop` and `websockets` exist too. **[secondary]** Two rules from common practice:
  - Start the server with `uvicorn.run(app, host=..., port=...)`, passing the **app object**. Do not pass the `"main:app"` string, and do not use `--reload` or `workers>1`: both re-import by name or start new processes.
  - Keep a **console** build, not `--noconsole`/`--windowed`. In a windowed build `sys.stdout` is `None`, which breaks uvicorn's logging and our ready line. Tauri already hides the console on Windows: the shell plugin sets `CREATE_NO_WINDOW` ([plugin source](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/shell/src/process/mod.rs)) **[official]**.
- **openpyxl.** **[official]** Has a hook in hooks-contrib. Nothing else expected.
- **pyobjc / ocrmac.** Neither PyInstaller core nor contrib has a hook for `objc`, `Vision`, `Quartz` or `CoreML` **[official]**: I checked both repos' hook trees. ocrmac 1.0.1 depends on `pyobjc-framework-Vision`, which pulls in Cocoa, Quartz and CoreML **[official, PyPI metadata]**. **[secondary]** pyobjc imports framework wrappers lazily, so expect hidden-import failures. Plan on `--collect-all objc --collect-all Vision --collect-all Quartz --collect-all CoreML --collect-all Foundation` and run the frozen binary against a real receipt image. I found no public report of ocrmac failing under PyInstaller, and none of it working either. **Needs the prototype.**
- **pillow-heif.** No hook **[official]**. It is a compiled extension that bundles libheif. **[secondary]** Use `--collect-all pillow_heif`, and call `register_heif_opener()` explicitly at import time rather than relying on plugin discovery. Test a real `.HEIC` from an iPhone.
- **segno, httpx, pydantic-core, Pillow.** Pillow has core hooks **[official]**. The others are plain or have no known problems.
- **`config.py` has to change for frozen mode.** `ROOT = Path(__file__).parent` resolves inside the bundle (`_internal/`), so the default `DATA_DIR` would write into the app bundle. Always pass `TALLY_DATA_DIR`. Seed fixtures and the Next.js static export must be added as PyInstaller `datas`, and code must find them through `sys._MEIPASS` or a path relative to `sys.executable`.

### Size [estimate]

Installed sizes from the dev venv on Eric's M-series Mac:

| Package | Size |
|---|---|
| `PIL` | 14 MB |
| `pillow_heif` | 12 MB |
| `objc` | 10 MB |
| `pydantic_core` | 4.6 MB |
| `uvloop` | 4.3 MB |
| `openpyxl` | 2.7 MB |
| AppKit, Foundation and Quartz | about 5 MB combined |
| fastapi, uvicorn, httpx, segno, watchfiles | about 5 MB combined |

The CPython 3.12 runtime is 71 MB as a full uv install. PyInstaller keeps only the stdlib it uses, typically 15–25 MB.

- **Installed:** onedir comes to roughly **80–110 MB**.
- **Download:** a compressed DMG or NSIS installer of roughly **30–45 MB**, plus a few MB for Tauri itself.
- **Windows:** smaller, because there is no pyobjc.
- **Possible trim:** `uvicorn[standard]` pulls in watchfiles (only needed for `--reload`). Plain `uvicorn` plus `websockets` and `httptools` may be enough.
- **Do not bundle WebView2:** the default `downloadBootstrapper` adds 0 MB, while `offlineInstaller` adds about 127 MB **[official, [Windows installer docs](https://v2.tauri.app/distribute/windows-installer/)]**.

### Cold start

- **[secondary]** On Linux, a trivial script started in 36 ms built as onedir and 150 ms built as onefile ([pistack benchmark](https://www.pistack.xyz/posts/2026-09-10-python-executable-packaging-pyinstaller-nuitka-cxfreeze-comparison/)). The onefile cost grows with bundle size.
- **[secondary]** [tauri-action#1156](https://github.com/tauri-apps/tauri-action/issues/1156): a Tauri + PyInstaller app on macOS 26 normally starts in about 2 s, but the **first launch of the DMG built in CI took about 45 s**. A maintainer suspects macOS malware scanning of about 1 GB of files. The issue is open and the cause is unconfirmed.
- Our own startup also runs `init_db`, `seed` and `recheck_open` before the server answers. **Measure spawn-to-`/health` on both OSes in the prototype.**

## 2. Lifecycle: start, port, data folder, health, stop, orphans

### Config

**[official]** Snippets adapted from the [sidecar docs](https://v2.tauri.app/develop/sidecar/), the [windows-installer docs](https://v2.tauri.app/distribute/windows-installer/) and [macOS signing](https://v2.tauri.app/distribute/sign/macos/).

Recommended: onedir shipped as resources.

```json
// src-tauri/tauri.conf.json (excerpt)
{
  "identifier": "ph.matchmo.tally",
  "app": { "windows": [] },               // create the window in setup() once the port is known
  "bundle": {
    "resources": { "../dist-sidecar/tally-api/": "tally-api/" },  // PyInstaller onedir output
    "macOS": { "signingIdentity": "-" },    // ad-hoc; see §5
    "windows": { "nsis": { "installMode": "currentUser" } }  // default; perMachine needs admin
  }
}
```

Alternative, the officially documented sidecar route (onefile):

```json
{ "bundle": { "externalBin": ["binaries/tally-api"] } }
// requires src-tauri/binaries/tally-api-aarch64-apple-darwin and tally-api-x86_64-pc-windows-msvc.exe
```

Only needed if JavaScript spawns the sidecar. We spawn from Rust, which capabilities don't restrict:

```json
// src-tauri/capabilities/default.json
{ "identifier": "default", "windows": ["main"],
  "permissions": ["core:default",
    { "identifier": "shell:allow-spawn",
      "allow": [{ "name": "binaries/tally-api", "sidecar": true,
                  "args": ["--port", { "validator": "\\d+" }] }] }] }
```

- **[official]** `app.shell().sidecar("tally-api")` takes the **file name only**, not `binaries/...`. In JavaScript, `Command.sidecar('binaries/tally-api', [...])` takes the full `externalBin` string, and its arguments must match the capability **exactly and in order**.

### Spawn, port and data folder (Rust sketch)

```rust
// lib.rs, sketch. Uses tauri-plugin-shell (Rust API) and tauri-plugin-single-instance.
.setup(|app| {
    let data = app.path().app_data_dir()?;           // see note on the path below
    let exe  = app.path().resource_dir()?.join("tally-api").join(if cfg!(windows) {"tally-api.exe"} else {"tally-api"});
    let (mut rx, child) = app.shell().command(exe)   // or .sidecar("tally-api") for externalBin
        .args(["--host", "0.0.0.0", "--port", "8765"])  // preferred port; server falls back to 0
        .env("TALLY_DATA_DIR", &data)
        .env("TALLY_WEB_URL", format!("http://{lan_ip}:{{port}}")) // or let the server compute it
        .spawn()?;
    app.manage(Sidecar(Mutex::new(Some(child))));
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        while let Some(ev) = rx.recv().await {
            if let CommandEvent::Stdout(l) = ev {
                if let Some(port) = parse_ready(&l) {        // "TALLY_READY port=8765"
                    wait_health(port).await;                 // GET /health, 200 within ~60 s
                    WebviewWindowBuilder::new(&handle, "main",
                        WebviewUrl::External(format!("http://127.0.0.1:{port}").parse().unwrap()))
                        .title("Tally").build().unwrap();
                }
            }
            // CommandEvent::Terminated => show "backend stopped" and offer a restart
        }
    });
    Ok(())
})
```

- **Port.**
  - **[secondary]** Pattern A, from the matshoppenbrouwers template: Rust binds port 0, reads the number and releases the port. This has a race window.
  - Pattern B, recommended: **the server binds**, then announces the actual port on stdout. There is no race.
  - Prefer a fixed default port (8765 is a placeholder) so the phone's capture link stays the same between runs. Fall back to `0` if it is taken.
  - The Windows firewall rule is per program, not per port, so a changing port does not cause new prompts.
- **Data folder.** **[official]** [`PathResolver`](https://docs.rs/tauri/latest/tauri/path/struct.PathResolver.html): `app_data_dir()` is `data_dir/${bundle_identifier}`. That means `~/Library/Application Support/ph.matchmo.tally` and `%APPDATA%\ph.matchmo.tally` (roaming). **This is not the `…/Tally` path in the map.** Either:
  - accept the identifier path,
  - use `data_dir().join("Tally")`, or
  - set `app > appDirectoriesOverride`.

  `app_log_dir()` is `~/Library/Logs/<id>` on macOS and `%LOCALAPPDATA%\<id>\logs` on Windows: a sensible home for sidecar logs.
- **Health.**
  - `GET /health` already exists in `routes/ops.py`. Poll it every 250 ms with an overall timeout of about 60 s, to allow for the first-launch scan in §1.
  - Show a bundled splash page meanwhile. `frontendDist` can hold a single `splash.html`.
- **Single instance.** Add `tauri-plugin-single-instance`. A second copy would fight over the port and the SQLite file.

### Stopping, and orphans after a crash

- **[official]** The [shell plugin source](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/shell/src/lib.rs):
  - On `RunEvent::Exit` it kills **only children spawned through the JavaScript `spawn` command**. Those are the only ones stored in its `children` map.
  - **A child spawned from Rust is not killed automatically.** We must kill it ourselves in `RunEvent::Exit`/`ExitRequested`.
  - `CommandChild::kill()` is SIGKILL on Unix and TerminateProcess on Windows. It hits the direct child only, never the process tree.
- **[secondary]** [dieharders/example-tauri-v2-python-server-sidecar](https://github.com/dieharders/example-tauri-v2-python-server-sidecar) warns that with a PyInstaller one-file build, `kill()` only stops the bootloader PID. The server itself keeps running. The same fan-out appears with Electron. **This is the main reason for onedir.**
- **Recommended shutdown sequence:**
  1. **Graceful.** On `ExitRequested`, call a new `POST /admin/shutdown` (or close stdin). The lifespan then runs `runner.stop()` and SQLite closes cleanly. Wait up to about 3 s, then `kill()`.
  2. **Tauri crash or force quit.** The shell plugin always gives the child a **piped stdin** **[official, source]**. In Python, a daemon thread blocks on `sys.stdin.read()`; at EOF it calls `os._exit(0)` or triggers graceful shutdown. When the parent dies, for any reason on either OS, the OS closes the pipe. This is the most portable orphan guard.
  3. **Windows extra (optional).** Put the child in a Job Object with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, through the `windows`/`win32job` crates. Windows then kills it when Tauri's handle closes, even on a hard kill. I did not find this in Tauri docs; it is standard Win32 practice.
  4. **Startup sweep.** Write `tally-api.pid` with the PID and the executable name into the data folder. At launch, if that PID is alive **and** its image name matches, kill it. The template checks the name because PIDs get reused.
  5. **Installer and update.** **[secondary]** The template's NSIS hooks `taskkill /T` the sidecar before files are replaced. The related [tauri#15134](https://github.com/tauri-apps/tauri/issues/15134) reports an `externalBin` sidecar not being replaced on reinstall.
- **[secondary]** The [matshoppenbrouwers template](https://github.com/matshoppenbrouwers/tauri-python-sidecar) also supervises the sidecar: it restarts on unexpected exit with 1, 2, 5, 5, 5 s backoff, then gives up and shows status in the UI. Worth copying for the queue runner.

## 3. Window loading `http://127.0.0.1:<port>`, and WebSockets

- **Loading a remote URL is supported.**
  - **[official]** The [localhost plugin docs](https://v2.tauri.app/plugin/localhost/) build the main window with `WebviewWindowBuilder::new(app, "main", WebviewUrl::External("http://localhost:PORT"))`. That is the same API we would use, with our own server instead of the plugin's.
  - Every `tauri dev` run already loads `devUrl` (`http://localhost:…`) in WKWebView and WebView2, with a WebSocket for hot reload. Loopback HTTP plus WebSocket is the normal path in both webviews.
- **IPC.**
  - **[official]** [Capabilities](https://v2.tauri.app/security/capabilities/): "By default the API is only accessible to bundled code shipped with the Tauri App." A remote origin gets Tauri commands only through a capability with `"remote": { "urls": [...] }`.
  - Our page uses only `fetch` and WebSocket to its own origin, so **it needs no capability and no IPC**.
  - If the first-run Ollama dialog needs native calls (opening the installer, for example), choose one:
    - add `{"identifier":"remote-local","windows":["main"],"remote":{"urls":["http://127.0.0.1:*"]},"permissions":[...]}`. Wildcard port matching is **unverified**: test it.
    - or, simpler, have FastAPI do it and call `webbrowser.open`/`subprocess` from Python.
- **CSP.**
  - **[official]** [CSP docs](https://v2.tauri.app/security/csp/): Tauri's CSP "is only enabled if set on the Tauri configuration file". Tauri injects nonces and hashes into **bundled** assets.
  - For a page served by FastAPI, Tauri does not rewrite anything. Any CSP is whatever FastAPI sends as a header. Same-origin `ws://127.0.0.1:port` is covered by `connect-src 'self'` in Chromium (WebView2); WebKit has historically been stricter about `'self'` covering `ws:`. Spell out `connect-src 'self' ws://127.0.0.1:*` if we add a CSP.
- **WebSocket.** Both WKWebView and WebView2 support `ws://`. The page is itself plain `http://`, so mixed-content rules do not apply.
  - **[official]** Tauri's [websocket plugin docs](https://v2.tauri.app/plugin/websocket/) use `ws://127.0.0.1:8080` in their example, though that plugin connects from Rust. We use the browser's own WebSocket.
- **macOS App Transport Security.** I could not confirm from Apple's page whether ATS applies inside a WKWebView loading `http://127.0.0.1`. Tauri's dev mode does exactly this in a built app, which is strong indirect evidence that it works. **Confirm in the prototype** with a release build, not `tauri dev`.
- **Same-origin bonus.** Because the window and the API share one origin, the UI needs no CORS for the desktop window.

## 4. Listening on the LAN for phone capture

- **Bind `0.0.0.0`.** Binding `127.0.0.1` would not need any firewall exception, but then the phone cannot connect.
- **Windows Defender Firewall.** **[official]** From [Windows Firewall rules](https://learn.microsoft.com/en-us/windows/security/operating-system-security/network-security/windows-firewall/rules):
  - With no allow rule, Windows prompts the first time the app listens.
  - "If the user has admin permissions, they're prompted. If they respond *No* or cancel the prompt, block rules are created."
  - "**If the user isn't a local admin and they are prompted, block rules are created. It doesn't matter what option is selected.**"
  - "once the rules are added, they must be deleted to generate the prompt again."
  - Rules use the program's full path, with no wildcards.

  For us:
  - The prompt names **`tally-api.exe`**, the sidecar, not Tally.exe.
  - Office laptops where the Reviewer is not an admin will silently break phone capture.
  - **[secondary]** The prompt has Private and Public network checkboxes. If the office Wi-Fi is set to *Public* and only *Private* is ticked, the phone is blocked.
  - **Mitigation:** add the rule at install time. Use `installMode: "perMachine"` (admin, installs under Program Files) with an `NSIS_HOOK_POSTINSTALL` running `netsh advfirewall firewall add rule name="Tally" dir=in action=allow program="$INSTDIR\…\tally-api.exe" profile=private,public remoteip=localsubnet`. Remove it in `NSIS_HOOK_POSTUNINSTALL`. **[official]** [NSIS hooks](https://v2.tauri.app/distribute/windows-installer/) exist, and the default `currentUser` mode needs no admin. Also detect "phone can't reach us" in-app and show instructions.
- **macOS Application Firewall.**
  - **[official]** [Apple](https://support.apple.com/guide/mac-help/change-firewall-settings-on-mac-mh11783/mac) has options to auto-allow incoming connections for built-in or downloaded software with a "valid certificate authority signature". **Ad-hoc signed apps don't qualify.**
  - **[secondary]** The firewall is off by default on macOS. When it is on, an unlisted app gets "Do you want the application 'tally-api' to accept incoming network connections?". The firewall identifies apps by code signature, so **ad-hoc signed builds may re-prompt after each update** ([Apple forums](https://developer.apple.com/forums/thread/740747)). Developer ID signing fixes it.
- **macOS Local Network privacy (Sequoia+).** **[official]** [TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy):
  - "Listening for and accepting incoming TCP connections" is **not** subject to the Local Network check. That covers the phone connecting to us.
  - Talking to Ollama on `127.0.0.1` is loopback, not local network.
  - Bonjour/mDNS or `.local` lookups **would** trigger the prompt. Don't add them without planning for it.
- **Security note.** `0.0.0.0` exposes the whole API, not just the capture page, to anyone on the office Wi-Fi with no authentication. That is the same as today's server setup, but on a laptop that moves between networks. Consider:
  - serving only the capture routes on the LAN interface (a second listener),
  - or a capture token in the QR URL.

## 5. Unsigned pilot builds: Gatekeeper and SmartScreen

### macOS (Sequoia 15 and later)

- **[official]** Tauri's [GitHub pipeline guide](https://v2.tauri.app/distribute/pipelines/github/) and [macOS signing guide](https://v2.tauri.app/distribute/sign/macos/):
  - Without a certificate, configure an **ad-hoc** identity, `"signingIdentity": "-"`. This "can avoid macOS treating Apple Silicon builds downloaded from GitHub releases as damaged".
  - Code signing "is required for all apps from the Internet" on Apple Silicon.
  - Ad-hoc signing "does not prevent macOS from requiring users to whitelist the installation in their Privacy & Security settings".
- **[secondary]** Apple removed **Control-click → Open** as a Gatekeeper bypass in macOS Sequoia ([9to5Mac](https://9to5mac.com/2024/08/13/security-bite-apple-finally-making-it-harder-to-override-gatekeeper-is-a-telling-move/), [Macworld](https://www.macworld.com/article/2457844/what-to-do-when-you-cant-open-an-app-you-just-installed-in-macos-sequoia.html)).
- **What the user does [official]** ([Apple support](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac); page currently shown for macOS 27):
  1. Open Tally. A warning says it can't be checked for malware. Click **Done**.
  2. Go to Apple menu → System Settings → Privacy & Security → Security → **Open Anyway**. The button "is available for about an hour after you try to open the app".
  3. Enter the login password, then click OK. Later launches are normal.
- **Terminal alternative for a hand-held pilot:** `xattr -dr com.apple.quarantine /Applications/Tally.app`. **[secondary]** Apple DTS calls this fine for internal distribution only.
- **Unknown:** the sidecar is ad-hoc signed inside the bundle. Does Gatekeeper's approval of the app cover it, or does `tally-api` get its own prompt? The onedir dylibs in `Resources/` raise the same question. Does Tauri's bundler sign them at all? **Prototype.**

### Windows 10/11

- **SmartScreen.** **[official]** [Microsoft: SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation):
  - An unsigned download shows "**Windows protected your PC**". The user must click **More info**, then **Run anyway**.
  - Reputation for an unsigned build restarts from zero with every new version.
  - EV certificates no longer bypass SmartScreen.
  - Microsoft's own signing service, Artifact Signing (formerly Trusted Signing), starts at $9.99/month.
  - Enterprise policy can remove the Run anyway option.
- **Browser warning.** **[secondary]** Edge or Chrome may also flag the `.exe` download as uncommon. The user picks *Keep*.
- **Smart App Control.**
  - **[official]** [Microsoft support](https://support.microsoft.com/en-us/topic/what-is-smart-app-control-285ea03d-fa88-4d56-882e-6698afdb7003): when it is **on**, Windows 11 **blocks unsigned apps**, and "There is currently no way to bypass Smart App Control protection for individual apps".
  - The only escape is turning Smart App Control off in Windows Security → App & browser control. Recent Windows updates let users turn it back on without reinstalling.
  - It is off on enterprise-managed devices and devices with developer mode on.
  - **[official]** Microsoft's SmartScreen page adds that its signature checks apply to *all* executables, not only downloads.
  - **Pilot check:** before sending a build, ask the accountant contact whether Smart App Control is on.
- **[secondary]** PyInstaller executables, especially onefile, draw antivirus false positives. Defender may quarantine `tally-api.exe`. Signing is the usual fix. Onedir lowers the risk.

## 6. Building both platforms in CI

- **Yes, GitHub Actions can build both, with no Mac or Windows machine needed for building.** Real-machine testing still matters: Simon's Windows laptop and a clean Mac.
- **[official]** Tauri's [GitHub pipeline guide](https://v2.tauri.app/distribute/pipelines/github/) has an official matrix workflow:
  - `macos-latest` with `--target aarch64-apple-darwin` gives "Arm based macs (M1 and above)".
  - `windows-latest` gives Windows x64.
  - The final step is `tauri-apps/tauri-action@v1`, which builds and uploads to a draft GitHub release.
- **[secondary]** `macos-latest` runs on Apple Silicon, so the arm64 sidecar is built natively. See [actions/runner-images](https://github.com/actions/runner-images).
- **[official]** PyInstaller cannot cross-compile (§1). Each matrix job must build its own sidecar first.

Matrix trimmed to our two targets:

```yaml
strategy:
  fail-fast: false
  matrix:
    include:
      - { platform: macos-latest,   args: "--target aarch64-apple-darwin" }
      - { platform: windows-latest, args: "" }
runs-on: ${{ matrix.platform }}
steps:
  - uses: actions/checkout@v4
  - uses: astral-sh/setup-uv@v6
  - run: uv sync --project api && uv run --project api pyinstaller api/tally-api.spec --distpath dist-sidecar   # onedir
  - uses: actions/setup-node@v4
    with: { node-version: lts/* }
  - run: npm ci --prefix web && npm run build --prefix web    # Next static export → copied into sidecar datas before PyInstaller, so order matters
  - uses: dtolnay/rust-toolchain@stable
    with: { targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin' || '' }} }
  - uses: swatinem/rust-cache@v2
    with: { workspaces: './src-tauri -> target' }
  - uses: tauri-apps/tauri-action@v1
    env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
    with: { tagName: app-v__VERSION__, releaseName: "Tally v__VERSION__", releaseDraft: true, args: ${{ matrix.args }} }
```

(The step order is illustrative: build `web/` before PyInstaller if the static export is bundled into the sidecar.)

- **Cost.** **[official]** [GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions): private-repo minutes count at **2×** on Windows and **10×** on macOS. Rust plus PyInstaller builds are slow, so use `rust-cache` and run releases on tag pushes only.

## Risks and unknowns for the prototype

1. **pyobjc/ocrmac frozen.** Does a PyInstaller onedir build actually run Vision OCR? It may need specific `--collect-all` flags. If it fights, fall back to python-build-standalone plus a venv.
2. **pillow-heif frozen.** Test opening a real iPhone `.HEIC`.
3. **Cold start.** Time spawn-to-`/health` on an M-series Mac (first launch after download and later launches) and on Simon's Windows laptop with Defender on. Watch for a long first launch like tauri-action#1156.
4. **Orphans.** Kill Tally with Force Quit on macOS and Task Manager → End task on Windows. Confirm the stdin-EOF guard stops `tally-api` and that SQLite stays intact (WAL).
5. **Windows firewall as a non-admin user.** Confirm the block-rule behaviour and test the `perMachine` + `netsh` install hook. Check what happens when the office Wi-Fi is set to *Public*.
6. **Gatekeeper and the nested binaries.** Download the ad-hoc signed DMG from a GitHub release onto a clean Mac running macOS 15+. Is there a single "Open Anyway", or does `tally-api` or a dylib trigger its own? Does the macOS firewall re-prompt after an update?
7. **Smart App Control.** Is it on for the pilot user's machine? If so, the unsigned pilot cannot run, which would pull Windows signing forward.
8. **Antivirus.** Upload `tally-api.exe` to VirusTotal and check Defender doesn't quarantine it.
9. **WKWebView in a release build** loading `http://127.0.0.1` plus `ws://`: confirm no ATS or CSP surprise. Also test `remote` capability URL matching with a wildcard port, if IPC is ever needed.
10. **Data path.** Decide between `app_data_dir()` (identifier path) and the map's `…/Tally` path.
11. **Size.** Measure the real DMG and NSIS sizes against the 30–45 MB estimate. Try dropping `uvicorn[standard]` extras.
12. **LAN exposure.** Decide whether the full API stays open on `0.0.0.0` or only the capture routes do.
