"""Model-free self-check, run from the repo root: python3 -m server.voice.selfcheck
Needs no models, mic or network. Exits 1 if any check fails."""
from __future__ import annotations

import math
import struct
import sys
import tempfile
from pathlib import Path

from .audio import Endpointer, pcm_to_wav
from .config import load_config, resolve_wake
from .phrases import match_wake_phrase, split_sentences
from .session import VoiceSession, WAKE_FRAME

fails: list[str] = []


def check(name: str, cond: bool) -> None:
    print(("ok   " if cond else "FAIL ") + name)
    if not cond:
        fails.append(name)


def tone(ms: int, amp: int = 6000) -> bytes:
    n = 16 * ms
    return b"".join(struct.pack("<h", int(amp * math.sin(i * 0.2))) for i in range(n))


def silence(ms: int) -> bytes:
    return b"\0\0" * (16 * ms)


tmp = Path(tempfile.mkdtemp())
c = load_config({}, tmp)
check("defaults", c.assistant_name == "Pheonix" and c.port == 8791 and c.tts_voice == "bm_george" and c.followup_timeout_s == 12)
check("default wake is hey pheonix via transcript", c.wake_mode == "transcript" and c.wake["phrase"] == "hey pheonix")
c = load_config({"ASSISTANT_NAME": "Pheonix"}, tmp)
check("unsupported phrase uses transcript matching", c.wake.get("transcript") and "lower accuracy" in c.wake["notice"])
check("public config reports phrase", c.public()["wakePhrase"] == "hey pheonix")
check("pretrained alexa accepted", resolve_wake("Alexa", "")["model"] == "alexa")
check("missing custom model uses transcript matching", resolve_wake("hey pheonix", "nope.onnx").get("transcript"))
(tmp / "m.onnx").write_bytes(b"x")
check("existing custom model honoured", resolve_wake("hey pheonix", "m.onnx", tmp)["custom"])
check("bad numbers fall back", load_config({"WAKE_THRESHOLD": "abc"}, tmp).wake_threshold == 0.5)

check("wake phrase fuzzy match", match_wake_phrase("Hey Jarvis, go to Paris", "hey jarvis") == (True, "go to paris"))
check("wake phrase STT slip", match_wake_phrase("hey jarvus", "hey jarvis")[0])
check("no false wake", not match_wake_phrase("hello there everyone", "hey jarvis")[0])
check("phoenix spellings match", all(match_wake_phrase(t, "hey pheonix")[0] for t in ("Hey Phoenix, take me to Paris", "hey fenix", "Hay Pheonix")))
check("sentence split", split_sentences("One. Two! Three?") == ["One.", "Two!", "Three?"])
check("wav header", pcm_to_wav(b"\0\0" * 10)[:4] == b"RIFF")

ep = Endpointer()
evs = ep.feed(silence(400) + tone(800) + silence(1000))
kinds = [k for k, _ in evs]
check("endpointer start+utterance", kinds == ["start", "utterance"])
check("endpointer ignores blips", [k for k, _ in Endpointer().feed(silence(200) + tone(60) + silence(1000))] == [])


class FakeWake:
    def __init__(self): self.n = 0
    def score(self, f): self.n += 1; return 0.9 if self.n == 3 else 0.0
    def reset(self): pass


t = [0.0]
s = VoiceSession(load_config({"WAKE_WORD": "hey jarvis"}, tmp), lambda b: "go to paris", FakeWake(), clock=lambda: t[0])
check("idle drops audio", s.feed(b"\0" * WAKE_FRAME * 2 * 5) == [])
s.set_mode("wake")
evs = s.feed(b"\0" * WAKE_FRAME * 2 * 5)
check("wake fires once then capture", [e["type"] for e in evs] == ["wake"] and s.mode == "capture")
evs = s.feed(silence(300) + tone(800) + silence(1000))
check("capture ends with a transcript, then idle", [e["type"] for e in evs] == ["speech_start", "processing", "transcript"] and s.mode == "idle")
s.set_mode("capture"); t[0] += 100
check("no-speech timeout", s.tick() == [{"type": "no_speech"}])
s.set_mode("capture"); s.set_muted(True)
check("muted drops audio", s.feed(tone(800)) == [])

print("\nselfcheck: %s" % ("FAILED (%d)" % len(fails) if fails else "all passed"))
sys.exit(1 if fails else 0)
