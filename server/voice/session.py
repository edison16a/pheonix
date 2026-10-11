"""Per-connection voice session: wake word, then capture of one utterance, then speech to text.
The detector, transcriber and clock are injected, so it can be tested without models or a mic."""
from __future__ import annotations

import time
from typing import Callable, Protocol

from .audio import Endpointer, SAMPLE_RATE
from .phrases import match_wake_phrase

WAKE_FRAME = 1280  # 80 ms at 16 kHz, the frame size openWakeWord expects
REFRACTORY_S = 2.0  # one spoken wake word scores high on several frames in a row, so ignore repeats this soon


class WakeDetector(Protocol):
    def score(self, frame_int16: bytes) -> float: ...
    def reset(self) -> None: ...


class VoiceSession:
    """Modes: 'idle' (drop audio), 'wake' (listen for the wake word), 'capture' (record one utterance).
    The browser drives the mode. The session moves itself from wake to capture on a wake event, and
    from capture to idle after a transcript, so the client always decides what happens next."""

    def __init__(self, cfg, transcribe: Callable[[bytes], str], wake: WakeDetector | None,
                 clock: Callable[[], float] = time.monotonic):
        self.cfg, self.transcribe, self.wake, self.clock = cfg, transcribe, wake, clock
        self.mode = "idle"
        self.muted = False
        self._ep = Endpointer()
        self._wbuf = b""
        self._last_wake = -1e9
        self._capture_started = 0.0
        self._heard_speech = False

    # Control from the browser.
    def set_mode(self, mode: str) -> None:
        if mode not in ("idle", "wake", "capture"):
            return
        self.mode = mode
        self._ep.reset()
        self._wbuf = b""
        self._heard_speech = False
        self._capture_started = self.clock()
        if self.wake:
            self.wake.reset()

    def set_muted(self, muted: bool) -> None:
        # The browser mutes while the assistant talks, so it never reacts to its own voice.
        self.muted = muted
        if not muted:
            self._ep.reset()
            self._wbuf = b""
            if self.wake:
                self.wake.reset()

    # Audio in, events out.
    def feed(self, pcm: bytes) -> list[dict]:
        if self.muted or self.mode == "idle" or not pcm:
            return []
        if self.mode == "wake":
            return self._feed_wake(pcm)
        return self._feed_capture(pcm)

    def tick(self) -> list[dict]:
        """Call periodically so a capture with no speech times out."""
        if self.mode == "capture" and not self._heard_speech and self.clock() - self._capture_started > self.cfg.listen_timeout_s:
            self.set_mode("idle")
            return [{"type": "no_speech"}]
        return []

    def _feed_wake(self, pcm: bytes) -> list[dict]:
        # Transcript mode is also the fallback when the wake model failed to load.
        if self.cfg.wake_mode == "transcript" or self.wake is None:
            return self._feed_wake_transcript(pcm)
        events: list[dict] = []
        self._wbuf += pcm
        step = WAKE_FRAME * 2
        while len(self._wbuf) >= step and self.mode == "wake":
            frame, self._wbuf = self._wbuf[:step], self._wbuf[step:]
            s = self.wake.score(frame)
            now = self.clock()
            if s >= self.cfg.wake_threshold and now - self._last_wake > REFRACTORY_S:
                self._last_wake = now
                events.append({"type": "wake", "score": round(float(s), 3), "method": "openwakeword"})
                self.set_mode("capture")
        return events

    def _feed_wake_transcript(self, pcm: bytes) -> list[dict]:
        """Wake detection without a model: transcribe short bursts of speech and look for the
        phrase. Costs CPU for every burst heard while on standby, and is less accurate."""
        events: list[dict] = []
        for kind, audio in self._ep.feed(pcm):
            if kind != "utterance" or len(audio) > SAMPLE_RATE * 2 * 4:  # only short (<=4 s) windows
                continue
            text = self.transcribe(audio)
            ok, rest = match_wake_phrase(text, self.cfg.wake.get("phrase", self.cfg.wake_word))
            if ok and self.clock() - self._last_wake > REFRACTORY_S:
                self._last_wake = self.clock()
                events.append({"type": "wake", "score": 1.0, "method": "transcript"})
                if rest:
                    # "hey pheonix go to Paris" in one breath: deliver the command right away.
                    events.append({"type": "transcript", "text": rest})
                    self.set_mode("idle")
                else:
                    self.set_mode("capture")
                break
        return events

    def _feed_capture(self, pcm: bytes) -> list[dict]:
        events: list[dict] = []
        for kind, audio in self._ep.feed(pcm):
            if kind == "start":
                self._heard_speech = True
                events.append({"type": "speech_start"})
            elif kind == "utterance":
                events.append({"type": "processing"})
                text = (self.transcribe(audio) or "").strip()
                self.set_mode("idle")
                events.append({"type": "transcript", "text": text} if text else {"type": "no_speech"})
                break
        return events
