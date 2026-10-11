"""PCM helpers and an energy-based utterance endpointer (stdlib only, 16 kHz mono int16)."""
from __future__ import annotations

import array
import io
import math
import wave

SAMPLE_RATE = 16000


def rms(pcm: bytes) -> float:
    """Loudness of a block of 16-bit PCM. Drops a trailing odd byte so a split sample cannot raise."""
    a = array.array("h")
    a.frombytes(pcm[: len(pcm) - (len(pcm) % 2)])
    if not a:
        return 0.0
    return math.sqrt(sum(x * x for x in a) / len(a))


def pcm_to_wav(pcm: bytes, rate: int = SAMPLE_RATE) -> bytes:
    """Wrap raw mono PCM in a WAV header, which is what whisper.cpp and the browser both want."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm)
    return buf.getvalue()


def floats_to_wav(samples, rate: int) -> bytes:
    """Turn float samples in [-1, 1] (list or numpy array) into 16-bit WAV bytes."""
    a = array.array("h", (max(-32768, min(32767, int(float(s) * 32767))) for s in samples))
    return pcm_to_wav(a.tobytes(), rate)


class Endpointer:
    """Cuts speech out of a PCM stream with a simple loudness gate, so we need no VAD model.

    feed() returns events: ("start", None) when speech begins and ("utterance", pcm) when it ends.
    An utterance is also forced at max_ms. The gate adapts to background noise: it only ever
    rises above `min_rms` when the quiet floor itself is loud. Short blips are thrown away."""

    def __init__(self, rate=SAMPLE_RATE, frame_ms=20, min_rms=350.0, floor_mult=3.0,
                 start_ms=120, end_silence_ms=700, min_speech_ms=250, max_ms=15000, preroll_ms=300):
        self.frame_bytes = int(rate * frame_ms / 1000) * 2
        self.frame_ms = frame_ms
        self.min_rms, self.floor_mult = min_rms, floor_mult
        self.start_frames = max(1, start_ms // frame_ms)
        self.end_frames = max(1, end_silence_ms // frame_ms)
        self.min_speech_frames = max(1, min_speech_ms // frame_ms)
        self.max_frames = max_ms // frame_ms
        self.preroll_frames = max(0, preroll_ms // frame_ms)
        self.reset()

    def reset(self) -> None:
        self._buf = b""
        self._pre: list[bytes] = []
        self._speech: list[bytes] = []
        self._in_speech = False
        self._loud = 0
        self._quiet = 0
        self.noise_floor = 120.0

    @property
    def in_speech(self) -> bool:
        return self._in_speech

    def feed(self, pcm: bytes) -> list[tuple[str, bytes | None]]:
        events: list[tuple[str, bytes | None]] = []
        self._buf += pcm
        fb = self.frame_bytes
        while len(self._buf) >= fb:
            frame, self._buf = self._buf[:fb], self._buf[fb:]
            level = rms(frame)
            # Learn the noise floor only from quiet frames, so speech does not raise the bar.
            threshold = max(self.min_rms, self.noise_floor * self.floor_mult)
            loud = level >= threshold
            if not self._in_speech:
                if not loud:
                    self.noise_floor = 0.95 * self.noise_floor + 0.05 * level
                self._pre.append(frame)  # keep a little audio from before the start, so first words are not clipped
                if len(self._pre) > self.preroll_frames + self.start_frames:
                    self._pre.pop(0)
                self._loud = self._loud + 1 if loud else 0
                if self._loud >= self.start_frames:
                    self._in_speech = True
                    self._speech = list(self._pre)
                    self._quiet = 0
                    events.append(("start", None))
            else:
                self._speech.append(frame)
                self._quiet = 0 if loud else self._quiet + 1
                voiced = len(self._speech) - self._quiet
                if self._quiet >= self.end_frames or len(self._speech) >= self.max_frames:
                    audio = b"".join(self._speech)
                    ok = voiced >= self.min_speech_frames
                    self._in_speech, self._speech, self._pre, self._loud, self._quiet = False, [], [], 0, 0
                    if ok:
                        events.append(("utterance", audio))
        return events
