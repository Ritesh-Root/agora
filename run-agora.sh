#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AGORA launcher — opens the app in Chrome with WebGPU enabled.
#
# The Office 3D view runs the agent simulation on GPU compute shaders, which is
# WebGPU-only. On Linux, Chrome exposes the WebGPU API but returns NO adapter
# unless --enable-unsafe-webgpu is set (and on hybrid AMD+NVIDIA laptops Vulkan
# is blocked by default), so the canvas renders blank. This launcher fixes that.
#
# Default: software WebGPU (SwiftShader) — verified stable on this machine.
# Opt-in:  AGORA_HW=1 ./run-agora.sh  → tries hardware WebGPU (Vulkan). Faster,
#          but can be unstable on hybrid GPUs (WebGPU "device lost").
#
# Usage:  ./run-agora.sh              # assumes dev server already on :3000
#         ./run-agora.sh --serve      # also starts `npm run dev` first
#         AGORA_HW=1 ./run-agora.sh   # experimental hardware WebGPU
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

URL="${AGORA_URL:-http://localhost:3000}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pick a Chrome/Chromium binary
CHROME=""
for c in google-chrome google-chrome-stable chromium chromium-browser brave-browser microsoft-edge; do
  if command -v "$c" >/dev/null 2>&1; then CHROME="$c"; break; fi
done
if [ -z "$CHROME" ]; then
  echo "No Chrome/Chromium/Edge found on PATH." >&2
  exit 1
fi

# Optionally start the dev server
if [ "${1:-}" = "--serve" ]; then
  echo "Starting dev server in $PROJECT_DIR ..."
  ( cd "$PROJECT_DIR" && npm run dev >/tmp/agora-vite.log 2>&1 & )
  for _ in $(seq 1 30); do
    if curl -s -o /dev/null -m 2 "$URL"; then break; fi
    sleep 1
  done
fi

# --enable-unsafe-webgpu exposes WebGPU even when only software is available.
FLAGS=( --enable-unsafe-webgpu )

if [ "${AGORA_HW:-0}" = "1" ]; then
  # Hardware path: deliver WebGPU via Vulkan and lift the hybrid-GPU interop block.
  FLAGS+=( --enable-features=Vulkan --disable-gpu-driver-bug-workarounds )
  echo "Mode: hardware WebGPU (Vulkan) — experimental"
else
  echo "Mode: software WebGPU (SwiftShader) — stable"
fi

echo "Launching $CHROME → $URL"
exec "$CHROME" "${FLAGS[@]}" --new-window "$URL"
