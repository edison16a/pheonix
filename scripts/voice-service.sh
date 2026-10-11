#!/usr/bin/env bash
# Starts the local Pheonix voice service. It listens on 127.0.0.1 only, never on the network.
# Usage: scripts/voice-service.sh   (or npm run voice)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ ! -x .voice/venv/bin/python ]; then
  echo "Voice not set up. Run: scripts/setup-voice.sh --yes" >&2
  exit 1
fi
# Port order: VOICE_PORT from the environment, then from .env, then 8791.
PORT="$(grep -E '^VOICE_PORT=' .env 2>/dev/null | tail -1 | cut -d= -f2 | tr -d ' ' || true)"
PORT="${VOICE_PORT:-${PORT:-8791}}"
exec .voice/venv/bin/python -m uvicorn server.voice.app:app --host 127.0.0.1 --port "$PORT" --log-level info
