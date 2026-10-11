"""FastAPI app for the local voice service.

Routes: GET /voice/config, GET /voice/health, POST /voice/tts, WS /voice/ws.
Start it with scripts/voice-service.sh, which binds uvicorn to 127.0.0.1 only.
"""
from __future__ import annotations

import asyncio
import json
import logging
import threading

from fastapi import FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import load_config
from .phrases import WARM_PHRASES
from .session import VoiceSession
from .stt import WhisperStt
from .tts import KokoroTts

log = logging.getLogger("pheonix.voice")
cfg = load_config()
stt = WhisperStt(cfg)
tts = KokoroTts(cfg)
# Set by _load_wake. Stays None when wake detection is transcript based or the model failed.
_wake_error = ""
_wake_cls = None


def _load_wake():
    """Import and warm up openWakeWord once at startup, so a missing package or model shows up
    in the logs and in /voice/config instead of failing on the first connection."""
    global _wake_cls, _wake_error
    if cfg.wake_mode == "transcript":
        return
    try:
        from .wake import OpenWakeWord
        _wake_cls = OpenWakeWord
        OpenWakeWord(cfg)  # builds the model once, which also loads its files
    except Exception as e:  # missing package or model files
        _wake_cls, _wake_error = None, f"{type(e).__name__}: {e}"
        log.warning("wake word unavailable: %s", _wake_error)


def status() -> dict:
    """Which of the three engines are really usable. The browser reads this to show honest warnings."""
    wake_ok = cfg.wake_mode == "transcript" or _wake_cls is not None
    return {
        "wake": {"ok": wake_ok, "engine": "transcript" if cfg.wake_mode == "transcript" else "openwakeword", "error": _wake_error},
        "stt": {"ok": stt.available, "engine": f"whisper.cpp/{stt.kind}", "model": cfg.stt_model},
        "tts": {"ok": tts.available, "engine": "kokoro-onnx", "voice": cfg.tts_voice},
    }


app = FastAPI(title="Pheonix voice", docs_url=None, redoc_url=None)
# Only pages served from this machine may call the service, so no random website can reach the mic or TTS.
app.add_middleware(CORSMiddleware, allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
                   allow_methods=["GET", "POST"], allow_headers=["*"])


@app.on_event("startup")
async def _startup():
    if cfg.wake.get("fallback"):
        log.warning("WAKE WORD: %s", cfg.wake["notice"])
    # Model loading blocks for seconds, so keep it off the event loop.
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, _load_wake)
    await loop.run_in_executor(None, stt.start)
    if tts.available:
        threading.Thread(target=_warm, daemon=True).start()
    log.info("voice status: %s", status())


def _warm():
    """Synthesise the stock replies ahead of time so the first "Yes, sir?" is not slow.
    Stops at the first failure, because the rest would fail the same way."""
    for p in WARM_PHRASES:
        try:
            tts.synth(p)
        except Exception as e:
            log.warning("tts warm failed: %s", e)
            return


@app.on_event("shutdown")
def _shutdown():
    stt.stop()


@app.get("/voice/config")
def get_config():
    return cfg.public(status())


@app.get("/voice/health")
def health():
    return {"ok": True, **status()}


@app.post("/voice/tts")
async def post_tts(request: Request):
    body = await request.json()
    text = str(body.get("text", "")).strip()[:600]  # replies are short, the cap just bounds the work
    if not text:
        raise HTTPException(400, "text required")
    if not tts.available:
        raise HTTPException(503, "TTS model not installed (run scripts/setup-voice.sh)")
    # Synthesis is CPU heavy and blocking, so it runs in a worker thread.
    wav = await asyncio.get_running_loop().run_in_executor(None, tts.synth, text, body.get("voice"))
    return Response(wav, media_type="audio/wav", headers={"Cache-Control": "no-store"})


@app.websocket("/voice/ws")
async def ws(sock: WebSocket):
    """One connection is one voice session. The browser sends 16 kHz PCM frames as binary
    messages and JSON control messages (mode, mute) as text. Events go back as JSON."""
    await sock.accept()
    loop = asyncio.get_running_loop()
    if not stt.available:
        await sock.send_json({"type": "error", "code": "stt-unavailable", "message": "Speech model not installed"})
    wake = None
    if _wake_cls is not None:
        wake = await loop.run_in_executor(None, _wake_cls, cfg)
    session = VoiceSession(cfg, stt.transcribe if stt.available else (lambda _b: ""), wake)
    await sock.send_json({"type": "ready", "config": cfg.public(status())})

    async def ticker():
        # Lets the session time out a capture where the user never spoke.
        while True:
            await asyncio.sleep(0.5)
            for ev in session.tick():
                await sock.send_json(ev)

    t = asyncio.create_task(ticker())
    try:
        while True:
            msg = await sock.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if msg.get("bytes") is not None:
                # feed() can run speech recognition, so it must not block the event loop.
                for ev in await loop.run_in_executor(None, session.feed, msg["bytes"]):
                    await sock.send_json(ev)
            elif msg.get("text"):
                try:
                    m = json.loads(msg["text"])
                except ValueError:
                    continue
                if m.get("type") == "mode":
                    session.set_mode(str(m.get("mode")))
                elif m.get("type") == "mute":
                    session.set_muted(bool(m.get("on")))
    except WebSocketDisconnect:
        pass
    finally:
        t.cancel()
