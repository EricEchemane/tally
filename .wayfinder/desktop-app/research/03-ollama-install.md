# Research 03: Ollama first-run install and model pull

Ticket: [03-ollama-first-run-install](../issues/03-ollama-first-run-install.md). Researched 2026-10-09 against Ollama **v0.40.2** (released 2026-10-08).

Markers: **[V]** = verified against a primary source (docs.ollama.com, the ollama GitHub repo source or release notes, the release assets themselves, the Ollama registry). **[S]** = secondary source or our own estimate; treat as a starting point and measure.

---

## Summary and recommendations for the setup dialog

1. **Detect** by calling `GET {base}/api/version` (returns `{"version":"0.40.2"}`), where `{base}` comes from our `OLLAMA_URL` setting, else the `OLLAMA_HOST` env var parsed the way Ollama parses it, else `http://127.0.0.1:11434`. If it does not answer, look for an installed but stopped Ollama (paths below) and start it hidden. **Require at least v0.12.5** (the first release where `think:false` plus a JSON-schema `format` works on `/api/chat` for thinking models). Older: tell the user to update (re-running the installer upgrades in place).
2. **Get it from the official URL at runtime. Don't bundle it.** Ollama is MIT, so bundling would be allowed, but `OllamaSetup.exe` is now **1.58 GB** (CUDA and other GPU libraries inside) and the macOS zip is 206 MB. Downloading from `https://ollama.com/download/...` means we never redistribute anything (no NOTICE files, no NVIDIA library terms) and always get the current version. Check the SHA-256 against the release's `sha256sum.txt`.
   - **Windows:** download `OllamaSetup.exe` and run `OllamaSetup.exe /VERYSILENT /NORESTART /SUPPRESSMSGBOXES`. It installs per user to `%LOCALAPPDATA%\Programs\Ollama` with **no UAC prompt**. Ollama's own `install.ps1` does exactly this. Create the empty marker file `%LOCALAPPDATA%\Ollama\upgraded` first so the tray app starts hidden, the same trick `install.ps1` uses. Wait for the installer process to exit (not its children), then poll `/api/version`.
   - **macOS:** there is no `.pkg` and no silent flag. Copy what Ollama's `install.sh` does on macOS: download `Ollama-darwin.zip`, unzip, move `Ollama.app` into `/Applications` (writable without sudo for an admin user; fall back to `~/Applications`), then `open -a Ollama --args hidden`. Skip the `/usr/local/bin/ollama` symlink because we only use the HTTP API. **Needs macOS 14 Sonoma or newer.** The setup dialog should check this and say so.
   - Fallback on both platforms: an "Open ollama.com/download" button, then the dialog keeps polling `/api/version`.
3. **Pull** with `POST /api/pull {"model":"qwen3:4b"}` and read the NDJSON stream. Show `completed/total` for the line whose `digest` matches the big layer (2,497,280,480 bytes). Progress lines arrive about every 60 ms, so throttle UI updates. **Cancel = close the HTTP connection.** The server stops downloading once nobody is waiting on the blob. **Resume = POST the same pull again.** Partial files are kept, but **Ollama deletes partial blobs older than 1 hour on server start**. Ask for **≥ 4 GB free** in the models folder before starting (the download is 2.5 GB, written to a pre-sized file).
4. **Settings:** everything in `api/llm/client.py` is per-request (`think`, `format`, `keep_alive`, `options.temperature/num_ctx/num_predict`), so it still works against a user-installed Ollama. The one exception is `OLLAMA_MAX_LOADED_MODELS=1` from `dev.sh`, a **server env var that a user-installed Ollama will not have** (default 3). Recommendation: don't try to set it. Ollama already evicts models when RAM runs short. Instead, check `GET /api/ps` before a scan and warn if another model is loaded. Also **change `keep_alive: -1` to a finite value (e.g. `"30m"`)** for the desktop app. On a user's 8 GB laptop, `-1` pins roughly 3 GB until Ollama quits.
5. **Windows speed:** a typical office laptop (Intel iGPU, no NVIDIA) runs **CPU only**. Ollama drops Intel/AMD iGPUs on Windows unless the server gets `OLLAMA_IGPU_ENABLE=1`. Expect roughly **8–16 tok/s generation** and **tens of tok/s prompt processing** for qwen3:4b Q4_K_M, i.e. **about 30–90 s per receipt instead of about 15 s** [S]. Simon should measure on his machine (method below) before the map's "Windows speed" fog is cleared.

---

## 1. Detecting Ollama

### Is it running, and which version? [V]
- `GET /` returns plain text `Ollama is running`. `GET /api/version` (also `HEAD`) returns `{"version":"<semver>"}`. Both routes are in `server/routes.go`. [source](https://github.com/ollama/ollama/blob/main/server/routes.go), [API docs](https://github.com/ollama/ollama/blob/main/docs/api.md)
- `GET /api/tags` lists local models: check for `"name":"qwen3:4b"` to skip the pull. `GET /api/ps` lists loaded models with `size`, `size_vram` and `expires_at`. [api.md](https://github.com/ollama/ollama/blob/main/docs/api.md)
- Use a short timeout (about 1–2 s) for the probe. Connection refused means "not running".

### Non-default host or port [V]
- Default bind is `127.0.0.1:11434`. It can be changed with `OLLAMA_HOST`. [FAQ](https://docs.ollama.com/faq)
- Ollama parses `OLLAMA_HOST` (`envconfig.Host()` in [envconfig/config.go](https://github.com/ollama/ollama/blob/main/envconfig/config.go)) like this: an optional `scheme://`, where no scheme means `http`. A missing port means `11434`, or 80/443 if a scheme is given. A bare `0.0.0.0` is a bind address, so the client should connect to `127.0.0.1` in that case.
- Where a user would have set it:
  - **Windows:** user or system environment variables (`HKCU\Environment` / `HKLM\...\Session Manager\Environment`). The tray app inherits them. A Tauri app launched afterwards sees them in its own env; read the registry directly to catch values set after we started.
  - **macOS:** `launchctl getenv OLLAMA_HOST`, because the FAQ tells users to use `launchctl setenv`.
- The Ollama app's "Expose Ollama to the network" setting changes the bind address, not the port. In practice a non-default port is rare. Probe in this order: `OLLAMA_URL` (ours), then `OLLAMA_HOST`, then `127.0.0.1:11434`.

### Installed but not running [V]
| | Where to look | How to start it hidden |
|---|---|---|
| Windows (official installer) | `%LOCALAPPDATA%\Programs\Ollama\ollama app.exe` (tray app) and `ollama.exe` (CLI/server); registry `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\{44E83376-CE68-45EB-8FC1-393500EB558C}_is1` (also check HKLM); custom dir via the uninstall key's `InstallLocation` | Launch `ollama app.exe` (it starts `ollama serve`). The installer runs it with `cmd /C set PATH={app};%PATH% & "{app}\ollama app.exe"` |
| macOS (app) | `/Applications/Ollama.app`, `~/Applications/Ollama.app`; CLI at `Ollama.app/Contents/Resources/ollama`; optional symlink `/usr/local/bin/ollama` | `open -a Ollama --args hidden` (from install.sh) |
| macOS (Homebrew, like our `setup.sh`) | `/opt/homebrew/bin/ollama`; runs via `brew services` | We can't start it cleanly. Tell the user, or run `ollama serve` ourselves as a last resort |

Sources: [ollama.iss](https://github.com/ollama/ollama/blob/main/app/ollama.iss) (AppId, `DefaultDirName={localappdata}\Programs\Ollama`, `MyAppExeName "ollama app.exe"`), [install.ps1](https://ollama.com/install.ps1) (`Find-InnoSetupInstall` checks the HKCU/HKLM uninstall keys), [install.sh](https://ollama.com/install.sh), [macOS docs](https://docs.ollama.com/macos), [Windows docs](https://docs.ollama.com/windows).

### Old version [V]
Minimum versions for features we rely on (from the GitHub release notes):
| Feature | First version |
|---|---|
| `keep_alive` API param; `-1` = forever | 0.1.23 / fixed 0.1.25 (2024-02) |
| `format` = JSON schema (structured outputs) | 0.5.0 (2024-12-04) |
| qwen3 models | 0.6.7 (2025-04-26) |
| `think` param | 0.9.0 (2025-05-29) |
| `think:false` no longer errors; **thinking models support structured outputs on `/api/chat`** | **0.12.5 (2025-10-10)** |

Recommended floor: **0.12.5**. The macOS and Windows apps auto-update (download in the background, then "Restart to update" in the tray or menubar; [FAQ](https://docs.ollama.com/faq)), so most installs will be current. For older ones, offer to run the same install flow, which upgrades in place.

Note for v0.40+ [V]: models pulled with older versions are converted in the background on first run, and **the original is kept as a backup**, so disk use doubles for those models until a future release removes the backups ([v0.40.2 notes](https://github.com/ollama/ollama/releases/tag/v0.40.2)). This only affects users who already had qwen3:4b from an old Ollama.

---

## 2. Getting Ollama

### Official artifacts (v0.40.2, checked 2026-10-09) [V]
`https://ollama.com/download/<file>` returns 307 to `github.com/ollama/ollama/releases/latest/download/<file>`, which serves the current release.

| File | Size | Use |
|---|---|---|
| `OllamaSetup.exe` | 1,578,560,904 B (1.58 GB) | Windows installer (Inno Setup), x64 + arm64 |
| `ollama-windows-amd64.zip` | 1.47 GB | Standalone CLI + NVIDIA libs, for embedding or running as a service ([Windows docs](https://docs.ollama.com/windows)) |
| `ollama-windows-amd64-rocm.zip` | 255 MB | Extra AMD ROCm libs for the standalone zip |
| `Ollama.dmg` | 207 MB | macOS app, drag-install |
| `Ollama-darwin.zip` | 206 MB | macOS app zip (what `install.sh` uses) |
| `ollama-darwin.tgz` | 167 MB | macOS CLI only |
| `sha256sum.txt` | | Checksums for all of the above |
| `install.ps1` / `install.sh` | | Official Windows / macOS+Linux install scripts |

Release asset list: `GET https://api.github.com/repos/ollama/ollama/releases/latest`. A specific version: `https://ollama.com/download/OllamaSetup.exe?version=0.40.2` (form used by install.ps1) or `.../releases/download/v0.40.2/OllamaSetup.exe`.

### Windows: silent per-user install [V]
- Inno Setup, `PrivilegesRequired=lowest` (no admin, no UAC), `DefaultDirName={localappdata}\Programs\Ollama`, `ArchitecturesAllowed=x64compatible arm64`, `MinVersion=10.0.10240`. The docs state **Windows 10 22H2 or newer**. [ollama.iss](https://github.com/ollama/ollama/blob/main/app/ollama.iss), [Windows docs](https://docs.ollama.com/windows)
- Silent flags: the .iss defines no custom ones, but Inno Setup's standard switches apply. **Ollama's own `install.ps1` runs `OllamaSetup.exe /VERYSILENT /NORESTART /SUPPRESSMSGBOXES` (plus `/DIR="..."` if `OLLAMA_INSTALL_DIR` is set)**, checks the Authenticode signature first, and treats a non-zero exit code as failure. The docs also document `/DIR="d:\some\location"`.
- Before installing, install.ps1 creates `%LOCALAPPDATA%\Ollama\upgraded` "so the app starts hidden". The `[Run]` entry is `postinstall nowait runhidden` without `skipifsilent`, so the tray app **does** launch after a silent install. install.ps1 waits only for the setup process: `Start-Process -PassThru` then `$proc.WaitForExit()`, "not children".
- The installer adds the install dir to the user `PATH` (HKCU\Environment), registers the `ollama://` protocol, and uses `SetupMutex=OllamaSetupMutex`. The installer itself creates no autostart entry; whether the app sets "start at login" itself was not verified.
- Logs: `%LOCALAPPDATA%\Ollama\app.log`, `server.log`, `upgrade.log`. Models: `%USERPROFILE%\.ollama\models`, or `OLLAMA_MODELS`. [Windows docs](https://docs.ollama.com/windows)
- Uninstall: Add/Remove Programs. The uninstall UI asks whether to delete models (checked by default).

### macOS [V]
- Requires **macOS 14 Sonoma+**. Apple Silicon gets CPU+GPU (Metal; MLX for supported architectures since v0.40.0). [macOS docs](https://docs.ollama.com/macos), [v0.40.0 notes](https://github.com/ollama/ollama/releases/tag/v0.40.0)
- Official methods: drag `Ollama.app` from `Ollama.dmg` into `/Applications` (docs), or `install.sh`'s macOS branch: `curl Ollama-darwin.zip` → `unzip` → `mv Ollama.app /Applications/` → symlink `/usr/local/bin/ollama` (may need `sudo`) → `open -a Ollama --args hidden`. No silent `.pkg` exists.
- On first launch the app offers to link the CLI into `/usr/local/bin` (admin prompt) and, if run from outside `/Applications`, asks "Move to Applications?" (docs). **Not verified:** whether `--args hidden` suppresses these prompts. Eric should test on his Mac.
- **Not verified [S]:** a file our (unsandboxed) Tauri app downloads with its own HTTP client should not get the `com.apple.quarantine` flag, so no Gatekeeper prompt. In any case the Ollama app is distributed signed and notarised by Ollama.
- Files: models `~/.ollama/models`, logs `~/.ollama/logs/{app,server}.log`.

### Licence and redistribution [V]
- Repo licence: **MIT**, "Copyright (c) Ollama". [LICENSE](https://github.com/ollama/ollama/blob/main/LICENSE) MIT allows redistribution if the copyright and permission notice is included.
- But the Windows installer and zip also carry third-party GPU runtimes (CUDA, ROCm) under their own licences. Shipping them inside our installer would bring those terms (and 1.5 GB) with them. **Downloading from ollama.com at run time sidesteps all of this**, so we redistribute nothing.
- The qwen3:4b weights are **Apache 2.0** (the licence layer in the model manifest; [library page](https://ollama.com/library/qwen3:4b)).
- "Ollama" is a name we should only use descriptively ("Tally uses Ollama to run the model locally"). Not a legal review.

---

## 3. Pulling the model

### `/api/pull` [V]
Request: `POST /api/pull` with `{"model":"qwen3:4b"}`; `stream` defaults to `true`; `insecure` is optional. The source also accepts a `runner` field. Response: `application/x-ndjson`, one JSON object per line, with fields `status`, `digest`, `total`, `completed`. [API ref](https://docs.ollama.com/api/pull), [api.md](https://github.com/ollama/ollama/blob/main/docs/api.md)

Example stream for qwen3:4b (layer sizes taken from the real manifest at `registry.ollama.ai/v2/library/qwen3/manifests/4b`; the status texts follow api.md and the `pulling <12 hex chars>` format in `server/download.go`):
```
{"status":"pulling manifest"}
{"status":"pulling 3e4cb1417446","digest":"sha256:3e4cb1417446...","total":2497280480,"completed":241970}
{"status":"pulling 3e4cb1417446","digest":"sha256:3e4cb1417446...","total":2497280480,"completed":118034432}
...
{"status":"pulling 2d54db2b9bb2","digest":"sha256:2d54db2b9bb2...","total":1506,"completed":1506}
{"status":"pulling d18a5cc71b84","digest":"sha256:d18a5cc71b84...","total":11338,"completed":11338}
{"status":"pulling cff3f395ef37","digest":"sha256:cff3f395ef37...","total":120,"completed":120}
{"status":"verifying sha256 digest"}
{"status":"writing manifest"}
{"status":"success"}
```
- Errors arrive **inside the stream** as `{"error":"..."}` (sometimes with `"status"`), with HTTP 200 already sent. Bad requests get HTTP 400 `{"error":...}` up front (`PullHandler` in routes.go). Treat any `error` key as failure.
- Progress is emitted on a **60 ms ticker** per blob (`blobDownload.Wait`), so throttle UI updates. The digests change when the tag is updated, so don't hard-code them. Pick the layer with the largest `total`, or sum all layers.
- Overall progress = Σcompleted / Σtotal over the digests seen. Already-present blobs report `completed == total` immediately.

### Resume and cancel [V from source]
- Docs: "Cancelled pulls are resumed from where they left off, and multiple calls will share the same download progress." [api.md](https://github.com/ollama/ollama/blob/main/docs/api.md)
- How it works (`server/download.go`): each blob downloads in up to 16 parallel parts of 100 MB–1 GB, using HTTP `Range`, into `<blob>-partial` (pre-truncated to full size, sparse) plus `-partial-N` part-state files. Each part retries 6 times with backoff. The download goroutine counts its waiters: **when the last HTTP client disconnects, the download is cancelled**, and the partial files stay for the next pull.
- **So cancelling = abort the HTTP request**, and **resuming = issue the same `/api/pull` again**. A dropped Wi-Fi connection shows up as a stream error or stall. Auto-retry the pull with backoff.
- Caveat: on server start Ollama prunes "invalid blobs (e.g. partial downloads)" whose mtime is **older than 1 hour** (`PruneLayers`, `layerPruneGracePeriod = time.Hour`; skipped if `OLLAMA_NOPRUNE`). A restart of Ollama or the PC more than an hour after an interrupted pull starts from zero.
- There is no "discard partial download" endpoint. Partials disappear through the prune above. `DELETE /api/delete` only removes completed models.
- Release-note history of resume fixes: 0.0.12, 0.0.15, 0.1.39, 0.3.2. It has been stable for a long time.

### Disk space [V]
- qwen3:4b = **Q4_K_M, 2,497,293,444 bytes total** (model layer 2,497,280,480 B; template 1.5 kB; licence 11 kB; params 120 B). Library page: "2.5GB", Apache 2.0.
- The partial file is pre-sized to the full layer, so the space is claimed immediately.
- Recommend: check free space on the volume holding the models dir (`OLLAMA_MODELS`, else `~/.ollama/models` / `%USERPROFILE%\.ollama\models`) and **require ≥ 4 GB** (2.5 GB + headroom). Add about 2 GB to our own installer budget on Windows if we also download `OllamaSetup.exe` to `%TEMP%`, which needs 1.6 GB plus about 4 GB for the installed binaries (the docs say "at least 4GB for the binary install").

---

## 4. Settings: per-request vs server env [V]

| Setting we use | Where | Per-request? | Default on a user's Ollama | Notes |
|---|---|---|---|---|
| `think: false` | `/api/chat` body | Yes | n/a | Needs ≥0.9.0; works with structured output since 0.12.5 |
| `format: <JSON schema>` | body | Yes | n/a | ≥0.5.0 |
| `options.temperature: 0` | body | Yes | model default | |
| `options.num_ctx: 4096` | body | Yes (**overrides** `OLLAMA_CONTEXT_LENGTH` and the app's context slider) | 4096 when <24 GiB VRAM; 32k at 24–48; 256k at ≥48 ([docs](https://docs.ollama.com/context-length)) | Keep sending it. Otherwise a big-VRAM machine loads a 32k+ context and uses far more RAM |
| `options.num_predict: 600` | body | Yes | | |
| `keep_alive: -1` | body | Yes (overrides `OLLAMA_KEEP_ALIVE`) | `5m` | **Rethink for desktop**: `-1` keeps about 3 GB resident indefinitely. Suggest `"30m"`, plus a warm-up call when a capture session starts |
| `OLLAMA_MAX_LOADED_MODELS=1` (dev.sh) | **Server env** | **No** | 0 → 3 × GPUs, or 3 on CPU ([FAQ](https://docs.ollama.com/faq), `MaxRunners` in envconfig) | We lose this on a user-installed Ollama |
| (implicit) `OLLAMA_NUM_PARALLEL` | Server env | No | 1 | Fine for us; RAM scales with parallel × ctx |
| (implicit) `OLLAMA_FLASH_ATTENTION`, `OLLAMA_KV_CACHE_TYPE` | Server env | No | auto / f16 | Not something we set today |
| `OLLAMA_IGPU_ENABLE`, `OLLAMA_VULKAN` | Server env | No | Vulkan on; iGPUs **off** except a few | See §5 |
| `OLLAMA_HOST`, `OLLAMA_MODELS` | Server env | No | 127.0.0.1:11434, `~/.ollama/models` | Read them for detection and disk checks |

Note: `dev.sh` sets `OLLAMA_MAX_LOADED_MODELS=1` on the **uvicorn** process, not on the Ollama server (which `setup.sh` starts with `brew services`). So it probably has no effect today either. Worth knowing before the team relies on it.

**How users configure a user-installed Ollama** [V, [FAQ](https://docs.ollama.com/faq)]:
- **macOS:** `launchctl setenv OLLAMA_X value`, then restart the Ollama app. [S] `launchctl setenv` does not survive a reboot. The app also has a Settings window (context length, model location, network exposure, cloud on/off).
- **Windows:** quit the tray app → Settings/Control Panel → "Edit environment variables for your account" → add the variable → start Ollama again from the Start menu. The equivalent from code is `setx OLLAMA_X value` (writes `HKCU\Environment`), then restart `ollama app.exe`.
- **Recommendation:** don't touch the user's Ollama env from Tally. Per-request settings cover everything except max-loaded-models, and Ollama's scheduler already evicts idle models when memory is short ([FAQ, concurrency](https://docs.ollama.com/faq)). Before a scan, check `GET /api/ps`. If a different model is loaded and RAM is tight, warn ("Another model (X) is using memory; scans may be slow"). Optionally offer an "unload it" button that sends `{"model":"X","keep_alive":0}` to `/api/generate`.
- Possible future option, not recommended now: run our own `ollama serve` from the standalone zip on a private port with our own env. That brings back full control, but means a 1.47 GB download and a second copy of the models.

---

## 5. Windows: GPU support and CPU speed

### GPU support (current main / v0.40.2) [V]
- **NVIDIA:** supported. Compute capability 5.0+, driver ≥550 (≥570 for CC 5.0–6.2); the Windows page says driver ≥551.61. [GPU docs](https://docs.ollama.com/gpu), [Windows docs](https://docs.ollama.com/windows)
- **AMD discrete:** ROCm v7 on Windows for RX 7600–7900 XTX and PRO W7500–W7900. Others, e.g. RX 6000, go through **Vulkan**, which is "enabled by default" and is the recommended fallback for RDNA2. [GPU docs](https://docs.ollama.com/gpu)
- **Vulkan timeline:** experimental from source in 0.12.6 (2025-10-15); opt-in `OLLAMA_VULKAN=1` in binaries in 0.12.11 (2025-11-12); on by default in current docs (the exact version of the switch was not pinned; 0.30.11, 2026-06-25, fixed Windows iGPU/dGPU classification and the Vulkan loader). [releases](https://github.com/ollama/ollama/releases); Phoronix coverage of [0.12.6](https://www.phoronix.com/news/ollama-Experimental-Vulkan) and [0.12.11](https://www.phoronix.com/news/ollama-0.12.11-Vulkan) [S].
- **Intel and AMD integrated GPUs: dropped by default.** `discover/runner.go` `filterIntegratedGPUs()` keeps an integrated GPU only if `OLLAMA_IGPU_ENABLE=1`, or if it is CUDA, or if it is ROCm on the Radeon 8060S (gfx1151, allowed by default since 0.30.2 / 2026-06-02). Otherwise it logs `dropping integrated GPU; to enable, set OLLAMA_IGPU_ENABLE=1`. Apple Silicon is exempt. [runner.go](https://github.com/ollama/ollama/blob/main/discover/runner.go)
  → **On a typical office laptop (Intel Iris Xe / Arc iGPU, or AMD Radeon iGPU) a stock Ollama runs CPU-only.** With `OLLAMA_IGPU_ENABLE=1` an Intel iGPU may help a little. One benchmark below: qwen3:4b 16.5 tok/s on CPU vs 18.0 on the iGPU (Core Ultra 5 125H), so it is not worth a setup step.
- Intel GPUs are not mentioned anywhere on the Windows or GPU docs pages other than through Vulkan. There is no official SYCL/IPEX support in Ollama; Intel's own `ipex-llm` fork exists separately.

### CPU-only speed for qwen3:4b (Q4_K_M, 2.5 GB weights) [S, estimate]
- Generation is bound by memory bandwidth: every token reads about 2.5 GB of weights.
  - DDR4-3200 dual-channel (51 GB/s theoretical): ≤20 tok/s ceiling, **about 8–14 tok/s** in practice.
  - **Single-channel RAM** (common in cheap 8 GB office laptops): **about 4–7 tok/s**.
  - LPDDR5x (Core Ultra / Ryzen 7040+): about 15–20 tok/s.
- Data point: qwen3:4b at **16.49 ± 0.15 tok/s on Core Ultra 5 125H CPU**, 18.00 on its iGPU, 127 on an RTX 3090 ([dachack/ollama-intel-docker](https://hub.docker.com/r/dachack/ollama-intel-docker), ipex-llm build, 64 GB RAM, about 2025-02, generation tok/s). This is the closest published number found; no clean published benchmark exists for qwen3:4b on an i5-1235U / Ryzen 5 5500U class laptop.
- Prompt processing on CPU is compute-bound. For a 4B model on a 4P+8E Intel U-series or 6–8 core Ryzen laptop, expect roughly **30–100 tok/s** (a Ryzen 5600H showed about 34 t/s pp512 on CPU vs about 76 on its iGPU via Vulkan in [this llama.cpp test](https://medium.com/@techhara/llama-cpp-benchmark-cpu-vs-igpu-93b3cc40ece5), model size unclear).
- **Per receipt:** with roughly 1,000–2,000 prompt tokens (system prompt + OCR text + schema) and about 200–400 output tokens, that comes to about 15–60 s of prompt processing plus about 20–50 s of generation. That is **roughly 30–90 s on CPU vs about 15 s on Apple Silicon**, and worse on battery or thermally throttled machines. Model load from disk adds about 5–20 s on the first call (another reason to warm up rather than hold `keep_alive: -1`).
- **How Simon should measure** (on his Windows machine, plugged in): run a real extraction and read `prompt_eval_count`, `prompt_eval_duration`, `eval_count`, `eval_duration`, `load_duration` from the non-streamed `/api/chat` response (durations are in ns), or run `ollama run qwen3:4b --verbose` and read "prompt eval rate" and "eval rate". Also record RAM channel configuration (Task Manager → Memory → "Slots used") and whether `server.log` says "dropping integrated GPU".

---

## Open items to test (not answerable from docs)
1. macOS: does `open -a Ollama --args hidden` after a fresh zip install still show the CLI-symlink or "Move to Applications" prompts? (Eric)
2. Windows: confirm `/VERYSILENT` + the `upgraded` marker gives no visible window and no SmartScreen prompt when launched from our process. (The installer is signed by Ollama; install.ps1 verifies the Authenticode signature.) (Simon)
3. Windows: real qwen3:4b timings per receipt, CPU-only, on Simon's laptop, with and without `OLLAMA_IGPU_ENABLE=1`.
4. Whether the Ollama app registers itself to start at login on each OS. This affects "installed but not running" frequency.
