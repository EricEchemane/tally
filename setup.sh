#!/usr/bin/env bash
# One-time setup on macOS (Eric's demo machine). Needs internet once; everything after runs offline.
set -euo pipefail
cd "$(dirname "$0")"

command -v brew >/dev/null || { echo "Install Homebrew first: https://brew.sh"; exit 1; }
for pkg in uv node ollama; do command -v "$pkg" >/dev/null || brew install "$pkg"; done

pgrep -x ollama >/dev/null || (brew services start ollama && sleep 2)
ollama pull qwen3:4b

(cd api && uv sync)
(cd web && npm install)
echo "Setup done. Run ./dev.sh"
