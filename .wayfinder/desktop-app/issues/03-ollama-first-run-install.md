# Ollama first-run install and model pull

Type: research (AFK)
Status: resolved
Assignee:
Blocked by: none

## Question

What does the first-run setup dialog have to do to get a working Ollama with `qwen3:4b` on macOS and Windows, without the user opening a terminal?
- Detecting Ollama: installed but not running, running on a non-default port, an old version
- Getting it: official installer URLs and formats per platform, silent or per-user install options, whether our app may download it or should send the user to ollama.com, licence terms for redistribution
- Pulling the model: the `/api/pull` streaming progress format, resuming after a dropped connection, disk space needed, cancelling
- Settings we rely on today (`OLLAMA_MAX_LOADED_MODELS=1`, `keep_alive`, `num_ctx`): which are per-request (we keep control) and which are server environment variables a user-installed Ollama won't have
- Windows: CPU-only speed expectations for a 4B model on a typical office laptop, and GPU support (NVIDIA, AMD, Intel)

## Answer

**Full findings are in [research/03-ollama-install.md](../research/03-ollama-install.md)** (checked against Ollama v0.40.2, released 2026-10-08).
- **Detect:** `GET /api/version` on our configured URL, then `OLLAMA_HOST`, then `127.0.0.1:11434`. Require v0.12.5 or newer (the first release where `think:false` works with a JSON-schema `format`). The research lists where a stopped install lives on each OS and how to start it hidden.
- **Install:** download it from ollama.com at setup time; don't bundle it. Ollama is MIT, but the Windows installer is 1.58 GB with GPU libraries under their own licences.
  - **Windows:** a silent, per-user install with no UAC prompt (`/VERYSILENT /NORESTART /SUPPRESSMSGBOXES`, as Ollama's own `install.ps1` does).
  - **macOS:** no silent installer. Unzip `Ollama-darwin.zip` into `/Applications`, then `open -a Ollama --args hidden`. Needs macOS 14 or newer.
- **Pull:** `/api/pull` streams NDJSON progress (qwen3:4b is about 2.5 GB; ask for 4 GB free). Cancel by closing the connection; resume by pulling again. Partial downloads older than 1 hour are deleted when Ollama restarts.
- **Settings:** everything `api/llm/client.py` sets is per request, so it works against a user's own Ollama. `OLLAMA_MAX_LOADED_MODELS` is a server setting we can't control; `dev.sh` sets it on uvicorn, not on Ollama, so it does nothing today. For the desktop app: change `keep_alive: -1` to about `"30m"` so a 3 GB model doesn't stay in RAM forever, and check `/api/ps` before a scan, warning if another model is loaded.
- **Windows GPU:** NVIDIA (driver 550+) and AMD (ROCm or Vulkan) work. Intel and most AMD integrated GPUs are skipped by default, so a typical office laptop runs on CPU. Estimate: **about 30–90 s per receipt**, against ~15 s on Apple Silicon. Unmeasured.
- **Still to test on real machines:** the macOS first-launch prompts, whether the Windows silent install shows any window or SmartScreen prompt, and real timings on Simon's laptop.
