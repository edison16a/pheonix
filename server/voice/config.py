"""Configuration for the voice service. Stdlib only so it can be self-checked without models."""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path

# openWakeWord ships only these pretrained models. Anything else needs a custom-trained model.
PRETRAINED_WAKE_MODELS = ("hey_jarvis", "alexa", "hey_mycroft", "hey_rhasspy", "timer", "weather")
DEFAULT_WAKE_MODEL = "hey_jarvis"
ROOT = Path(__file__).resolve().parents[2]


def parse_env_file(path: Path) -> dict[str, str]:
    """Read KEY=value lines from a .env file without needing python-dotenv.
    Handles comments, quoted values and trailing " # comment". A missing file is just empty."""
    out: dict[str, str] = {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return out
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        elif " #" in val:
            val = val.split(" #", 1)[0].strip()
        out[key.strip()] = val
    return out


def slug(phrase: str) -> str:
    """Turn a phrase into the openWakeWord model name form: hey jarvis becomes hey_jarvis."""
    return re.sub(r"[^a-z0-9]+", "_", phrase.lower()).strip("_")


def resolve_wake(wake_word: str, wake_model: str, root: Path = ROOT) -> dict:
    """Decide how the wake phrase will be detected and say so honestly in `notice`.

    A pretrained model or an existing .onnx file gives model based detection. For any other
    phrase there is no model, so the result is flagged `transcript` and the phrase is matched
    on short local transcripts instead. It never pretends an arbitrary phrase has a model.
    """
    requested = wake_word.strip() or "hey jarvis"
    if wake_model:
        p = Path(wake_model)
        if not p.is_absolute():
            p = root / p
        if p.suffix == ".onnx" and p.exists():
            return {"model": str(p), "phrase": requested, "requested": requested, "fallback": False, "custom": True, "notice": ""}
        if slug(wake_model) in PRETRAINED_WAKE_MODELS:
            m = slug(wake_model)
            return {"model": m, "phrase": m.replace("_", " "), "requested": requested, "fallback": False, "custom": False, "notice": ""}
        notice = f"WAKE_MODEL '{wake_model}' is not a pretrained model or an existing .onnx file; "
    else:
        notice = ""
        if slug(requested) in PRETRAINED_WAKE_MODELS:
            m = slug(requested)
            return {"model": m, "phrase": m.replace("_", " "), "requested": requested, "fallback": False, "custom": False, "notice": ""}
    # No pretrained openWakeWord model for this phrase: match it on short local transcripts
    # instead. That is less accurate than a trained model, but it really is the phrase asked for.
    notice += (
        f"no pretrained openWakeWord model exists for '{requested}', so it is matched from local "
        "speech recognition (lower accuracy). Train a custom model (see docs/VOICE.md) and set "
        "WAKE_MODEL=path/to/model.onnx for better accuracy."
    )
    return {"model": None, "phrase": requested, "requested": requested, "fallback": False, "transcript": True, "custom": False, "notice": notice[0].upper() + notice[1:]}


@dataclass
class VoiceConfig:
    assistant_name: str = "Pheonix"
    user_name: str = ""
    address_as: str = "sir"
    wake_word: str = "hey pheonix"
    wake_model: str = ""
    wake_mode: str = "model"  # "model" is openWakeWord, "transcript" matches the phrase in local speech text
    wake_threshold: float = 0.5
    tts_voice: str = "bm_george"
    stt_model: str = "base.en"
    followup_timeout_s: float = 12.0
    listen_timeout_s: float = 8.0
    port: int = 8791  # also the default the browser tries, see SERVICE_PORT in src/voice/assistant/config.js
    model_dir: Path = field(default_factory=lambda: ROOT / ".voice" / "models")
    cache_dir: Path = field(default_factory=lambda: ROOT / ".voice" / "cache")
    wake: dict = field(default_factory=dict)

    def public(self, status: dict | None = None) -> dict:
        """JSON served from GET /voice/config (no filesystem paths, nothing secret)."""
        return {
            "assistantName": self.assistant_name,
            "userName": self.user_name,
            "addressAs": self.address_as,
            "wakePhrase": self.wake.get("phrase", self.wake_word),
            "wakeRequested": self.wake.get("requested", self.wake_word),
            "wakeFallback": bool(self.wake.get("fallback")),
            "wakeNotice": self.wake.get("notice", ""),
            "wakeMode": self.wake_mode,
            "wakeThreshold": self.wake_threshold,
            "voice": self.tts_voice,
            "sttModel": self.stt_model,
            "followUpTimeoutS": self.followup_timeout_s,
            "listenTimeoutS": self.listen_timeout_s,
            "models": status or {},
        }


def _f(env: dict, key: str, default: float) -> float:
    """Float setting that falls back to the default instead of crashing on a typo in .env."""
    try:
        return float(env[key])
    except (KeyError, ValueError):
        return default


def load_config(env: dict[str, str] | None = None, root: Path = ROOT) -> VoiceConfig:
    """Build the config from .env plus real environment variables (the environment wins).
    Passing `env` skips both, which is how the self-check gets repeatable settings."""
    if env is None:
        merged = parse_env_file(root / ".env")
        merged.update({k: v for k, v in os.environ.items()})
        env = merged
    name = env.get("ASSISTANT_NAME", "").strip() or "Pheonix"
    wake_word = env.get("WAKE_WORD", "").strip() or f"hey {name.lower()}"
    cfg = VoiceConfig(
        assistant_name=name,
        user_name=env.get("USER_NAME", "").strip(),
        address_as=env.get("ADDRESS_AS", "").strip() or "sir",
        wake_word=wake_word,
        wake_model=env.get("WAKE_MODEL", "").strip(),
        wake_mode="transcript" if env.get("WAKE_MODE", "").strip().lower() == "transcript" else "model",
        wake_threshold=min(0.99, max(0.05, _f(env, "WAKE_THRESHOLD", 0.5))),
        tts_voice=env.get("TTS_VOICE", "").strip() or "bm_george",
        stt_model=env.get("STT_MODEL", "").strip() or "base.en",
        followup_timeout_s=max(2.0, _f(env, "FOLLOWUP_TIMEOUT_S", 12.0)),
        listen_timeout_s=max(2.0, _f(env, "LISTEN_TIMEOUT_S", 8.0)),
        port=int(_f(env, "VOICE_PORT", 8791)),
        model_dir=root / ".voice" / "models",
        cache_dir=root / ".voice" / "cache",
    )
    cfg.wake = resolve_wake(wake_word, cfg.wake_model, root)
    # A phrase with no model forces transcript mode, whatever WAKE_MODE said.
    if cfg.wake.get("transcript"):
        cfg.wake_mode = "transcript"
    return cfg
