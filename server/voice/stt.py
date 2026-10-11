"""Local speech-to-text via whisper.cpp. Prefers a resident whisper-server (model stays loaded);
falls back to spawning whisper-cli per utterance."""
from __future__ import annotations

import http.client
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import uuid

from .audio import pcm_to_wav

SERVER_PORT = 8178  # whisper-server's own port on loopback, separate from the voice service port


def find_binary(*names: str) -> str | None:
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    return None


def model_path(cfg) -> str:
    """Where setup-voice.sh puts the whisper.cpp model for the configured STT_MODEL."""
    return str(cfg.model_dir / f"ggml-{cfg.stt_model}.bin")


class WhisperStt:
    """whisper.cpp speech to text. A resident whisper-server keeps the model in memory, which
    makes each phrase much faster than starting whisper-cli every time."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.model = model_path(cfg)
        self.server_bin = find_binary("whisper-server")
        self.cli_bin = find_binary("whisper-cli", "whisper-cpp")
        self._proc: subprocess.Popen | None = None
        self.kind = "server" if self.server_bin else ("cli" if self.cli_bin else "none")

    @property
    def available(self) -> bool:
        return self.kind != "none" and os.path.exists(self.model)

    def start(self) -> None:
        """Launch whisper-server and wait for it to answer. Falls back to the CLI if it never does."""
        if self.kind != "server" or not self.available or self._proc:
            return
        self._proc = subprocess.Popen(
            [self.server_bin, "-m", self.model, "--host", "127.0.0.1", "--port", str(SERVER_PORT), "-l", "en"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        for _ in range(60):  # up to ~15 s for the model to load
            try:
                c = http.client.HTTPConnection("127.0.0.1", SERVER_PORT, timeout=1)
                c.request("GET", "/")
                c.getresponse().read()
                return
            except OSError:
                time.sleep(0.25)
        self.kind = "cli" if self.cli_bin else "none"  # server never came up

    def stop(self) -> None:
        if self._proc:
            self._proc.terminate()
            self._proc = None

    def transcribe(self, pcm: bytes) -> str:
        """Text for one utterance of 16 kHz PCM. Uses the CLI if the server connection drops."""
        wav = pcm_to_wav(pcm)
        if self.kind == "server":
            try:
                return self._via_server(wav)
            except OSError:
                if not self.cli_bin:
                    raise
        return self._via_cli(wav)

    def _via_server(self, wav: bytes) -> str:
        # whisper-server wants a multipart form upload. Built by hand to avoid a dependency.
        boundary = uuid.uuid4().hex
        parts = [
            ("response_format", "json"), ("temperature", "0.0"),
        ]
        body = b""
        for k, v in parts:
            body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\n'
                 "Content-Type: audio/wav\r\n\r\n").encode() + wav + f"\r\n--{boundary}--\r\n".encode()
        c = http.client.HTTPConnection("127.0.0.1", SERVER_PORT, timeout=30)
        c.request("POST", "/inference", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})
        data = json.loads(c.getresponse().read().decode("utf-8", "replace"))
        return clean_transcript(data.get("text", ""))

    def _via_cli(self, wav: bytes) -> str:
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "u.wav")
            with open(p, "wb") as f:
                f.write(wav)
            r = subprocess.run([self.cli_bin, "-m", self.model, "-f", p, "-nt", "-np", "-l", "en"],
                               capture_output=True, text=True, timeout=60)
            return clean_transcript(r.stdout)


def clean_transcript(text: str) -> str:
    """Strip whisper's bracketed non-speech tags such as [BLANK_AUDIO] or (music) and tidy spaces."""
    t = " ".join(text.split())
    t = re.sub(r"\[[^\]]*\]|\([^)]*\)", " ", t)
    return " ".join(t.split())
