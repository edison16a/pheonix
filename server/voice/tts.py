"""Local TTS: Kokoro-82M via kokoro-onnx. Disk + memory cache, sentence-level synthesis."""
from __future__ import annotations

import hashlib
import threading

from .audio import floats_to_wav
from .phrases import split_sentences


class KokoroTts:
    """Kokoro speech synthesis. Replies repeat a lot, so every result is cached in memory and on
    disk, and the model itself is only loaded the first time something is spoken."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.model_file = cfg.model_dir / "kokoro-v1.0.onnx"
        self.voices_file = cfg.model_dir / "voices-v1.0.bin"
        self.cache = cfg.cache_dir / "tts"
        self._mem: dict[str, bytes] = {}
        self._kokoro = None
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        return self.model_file.exists() and self.voices_file.exists()

    def _engine(self):
        # Loading takes a while and synth() runs in worker threads, so only one may load it.
        with self._lock:
            if self._kokoro is None:
                from kokoro_onnx import Kokoro
                self._kokoro = Kokoro(str(self.model_file), str(self.voices_file))
            return self._kokoro

    def key(self, text: str, voice: str) -> str:
        """Cache key. The voice is part of it so changing TTS_VOICE never replays old audio."""
        return hashlib.sha1(f"{voice}\0{text}".encode()).hexdigest()

    def synth(self, text: str, voice: str | None = None) -> bytes:
        """WAV bytes for `text`, from cache when we have said it before."""
        voice = voice or self.cfg.tts_voice
        k = self.key(text, voice)
        if k in self._mem:
            return self._mem[k]
        f = self.cache / f"{k}.wav"
        if f.exists():
            wav = f.read_bytes()
        else:
            samples, rate = self._engine().create(text, voice=voice, speed=1.0, lang="en-gb")
            wav = floats_to_wav(samples, rate)
            self.cache.mkdir(parents=True, exist_ok=True)
            f.write_bytes(wav)
        if len(self._mem) > 200:  # keep memory bounded, the disk cache still has everything
            self._mem.pop(next(iter(self._mem)))
        self._mem[k] = wav
        return wav

    def sentences(self, text: str) -> list[str]:
        return split_sentences(text)
