"""openWakeWord wrapper (lazy import: needs `pip install openwakeword onnxruntime`)."""
from __future__ import annotations


class OpenWakeWord:
    """Scores 80 ms audio frames against one wake word model. Imported lazily because the
    package is heavy and only needed when model based wake detection is on."""

    def __init__(self, cfg):
        import numpy as np  # noqa: F401  (openwakeword requires it)
        from openwakeword.model import Model

        self._np = np
        model = cfg.wake["model"]
        self._key = None
        try:
            self._model = Model(wakeword_models=[model], inference_framework="onnx")
        except TypeError:
            self._model = Model(wakeword_models=[model])
        # score dict keys are model names (file stem, possibly with a version suffix)
        self._stem = model.rsplit("/", 1)[-1].replace(".onnx", "")

    def score(self, frame_int16: bytes) -> float:
        """Score from 0 to 1 for how likely the wake word was just said."""
        a = self._np.frombuffer(frame_int16, dtype=self._np.int16)
        out = self._model.predict(a)
        if self._key is None:
            self._key = next((k for k in out if self._stem in k or k in self._stem), next(iter(out), None))
        return float(out.get(self._key, 0.0)) if self._key else 0.0

    def reset(self) -> None:
        """Clear the model's internal audio history, used whenever the listening mode changes."""
        try:
            self._model.reset()
        except Exception:
            pass
