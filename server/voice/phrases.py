"""Text helpers: wake phrase matching over transcripts, and sentence splitting for chunked TTS."""
from __future__ import annotations

import difflib
import re

_SENT = re.compile(r"(?<=[.!?])\s+")


def normalise(text: str) -> str:
    """Lowercase, drop punctuation and collapse spaces, so transcripts compare cleanly."""
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9' ]+", " ", text.lower())).strip()


# Speech recognition spells "pheonix" many ways and sometimes hears "hey" as "a", so these are
# folded to one spelling before comparing. Fuzzy matching below handles the rest.
_ALIASES = {
    **dict.fromkeys(("phoenix", "pheonix", "phenix", "fenix", "feenix", "phoenics", "finix", "pheenix", "phoenixs"), "pheonix"),
    "hay": "hey", "hei": "hey", "hay,": "hey", "a": "hey",
}


def _canon(words: list[str]) -> list[str]:
    return [_ALIASES.get(w, w) for w in words]


def match_wake_phrase(transcript: str, phrase: str, min_ratio: float = 0.82) -> tuple[bool, str]:
    """Fallback wake detection: does the transcript start with the wake phrase, or have it
    within its first few words? Returns (matched, text after the phrase). Each word is compared
    fuzzily so small recognition slips ("jarvus") still match, but it is less accurate than a
    trained wake model."""
    t, p = _canon(normalise(transcript).split()), _canon(normalise(phrase).split())
    if not t or not p:
        return False, ""
    n = len(p)
    # Only look at the first few positions: a wake phrase buried mid-sentence is not a wake.
    for start in range(0, min(3, max(1, len(t) - n + 1))):
        window = t[start : start + n]
        if len(window) < n:
            break
        if all(difflib.SequenceMatcher(None, a, b).ratio() >= min_ratio for a, b in zip(window, p)):
            return True, " ".join(t[start + n :])
    return False, ""


def split_sentences(text: str, max_len: int = 220) -> list[str]:
    """Break text into sentences, and long ones at a comma or space, so speech can start early.
    Mirrors splitSentences in src/voice/service/speech.js, keep the two in step."""
    out: list[str] = []
    for part in _SENT.split(text.strip()):
        part = part.strip()
        while len(part) > max_len:
            cut = part.rfind(",", 0, max_len)
            cut = cut if cut > 40 else part.rfind(" ", 0, max_len)
            cut = cut if cut > 0 else max_len
            out.append(part[: cut + 1].strip())
            part = part[cut + 1 :].strip()
        if part:
            out.append(part)
    return out


# Short stock replies, synthesised at startup so they play instantly.
WARM_PHRASES = [
    "Yes, sir?",
    "Very good, sir. Standing by.",
    "Certainly, sir.",
    "I'm afraid I didn't catch that, sir.",
    "I'm afraid I didn't understand that, sir.",
    "Returning to the world view, sir.",
    "Closing all camera feeds, sir.",
]
