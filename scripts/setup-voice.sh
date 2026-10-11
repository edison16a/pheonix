#!/usr/bin/env bash
# Sets up the local voice stack: Python venv, packages, models and whisper.cpp.
# It downloads about 0.7 GB, so it prints the whole plan first and does nothing without --yes.
# Safe to run again: anything already present is skipped.
#   scripts/setup-voice.sh --yes [--tiny] [--no-brew] [--python /path/to/python3]
set -euo pipefail
# Always work from the repo root so .voice/ lands in the same place however it is called.
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
YES=0; TINY=0; BREW=1; PY="$(command -v python3 || true)"
while [ $# -gt 0 ]; do
  case "$1" in
    --yes) YES=1;; --tiny) TINY=1;; --no-brew) BREW=0;; --python) PY="$2"; shift;;
    *) echo "unknown option $1" >&2; exit 2;;
  esac; shift
done
# tiny.en is smaller and faster, base.en is the default because it mishears less.
STT=base.en; STT_SIZE="~142 MB"; [ "$TINY" = 1 ] && { STT=tiny.en; STT_SIZE="~75 MB"; }
MODELS=.voice/models
KOKORO_BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
WHISPER_URL=https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$STT.bin

cat <<PLAN
Pheonix voice setup will (all inference stays local; downloads happen once):
  1. python venv:        $PY -m venv .voice/venv
  2. pip install:        -r server/voice/requirements.txt  (numpy, onnxruntime, openwakeword, kokoro-onnx, fastapi, uvicorn; ~250 MB)
  3. openWakeWord:       hey_jarvis + feature models via openwakeword.utils.download_models (~10 MB)
  4. Kokoro-82M ONNX:    $KOKORO_BASE/kokoro-v1.0.onnx            (~310 MB)
                         $KOKORO_BASE/voices-v1.0.bin             (~27 MB)
  5. whisper.cpp model:  $WHISPER_URL  ($STT_SIZE)
  6. whisper.cpp binary: brew install whisper-cpp                 (~30 MB; skipped with --no-brew or if present)
Total: roughly 0.7 GB.
PLAN
if [ "$YES" != 1 ]; then echo; echo "Nothing done. Re-run with --yes to proceed."; exit 0; fi
[ -n "$PY" ] || { echo "python3 not found" >&2; exit 1; }

[ -x .voice/venv/bin/python ] || "$PY" -m venv .voice/venv
.voice/venv/bin/python -m pip install --upgrade pip >/dev/null
.voice/venv/bin/python -m pip install -r server/voice/requirements.txt

mkdir -p "$MODELS" .voice/cache
# The wake model is only used when WAKE_MODE=model, but its shared feature models are needed either way.
.voice/venv/bin/python - <<'PYEOF'
import openwakeword
from openwakeword.utils import download_models
download_models(["hey_jarvis"])
print("openWakeWord models ready")
PYEOF

# Download to a .part file and rename when done, so an interrupted download is never mistaken for a finished one.
fetch() { # url dest
  if [ -s "$2" ]; then echo "have $(basename "$2")"; else curl -fL --progress-bar -o "$2.part" "$1" && mv "$2.part" "$2"; fi
}
fetch "$KOKORO_BASE/kokoro-v1.0.onnx" "$MODELS/kokoro-v1.0.onnx"
fetch "$KOKORO_BASE/voices-v1.0.bin" "$MODELS/voices-v1.0.bin"
fetch "$WHISPER_URL" "$MODELS/ggml-$STT.bin"

if ! command -v whisper-server >/dev/null && ! command -v whisper-cli >/dev/null; then
  if [ "$BREW" = 1 ] && command -v brew >/dev/null; then brew install whisper-cpp
  else echo "WARNING: whisper.cpp binary missing. Install: brew install whisper-cpp" >&2; fi
fi
echo; echo "Voice setup complete. Start with: scripts/voice-service.sh   (or npm run voice)"
[ "$STT" = tiny.en ] && echo "Remember to set STT_MODEL=tiny.en in .env"
