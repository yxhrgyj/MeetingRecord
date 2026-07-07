from dataclasses import dataclass
from typing import Protocol

from app.config import DEFAULT_LANGUAGE


@dataclass(frozen=True)
class TranscriptionResult:
    text: str
    language: str = DEFAULT_LANGUAGE


class Recognizer(Protocol):
    model_loaded: bool
    device: str

    def transcribe_wav(self, data: bytes) -> TranscriptionResult:
        ...


class NemoRecognizer:
    model_loaded = False
    device = "cuda"

    def __init__(self) -> None:
        self._model = None

    def _load_model(self):
        if self._model is None:
            import nemo.collections.asr as nemo_asr

            self._model = nemo_asr.models.ASRModel.from_pretrained(
                model_name="nvidia/nemotron-3.5-asr-streaming-0.6b"
            )
            self._model = self._model.to("cuda")
            self.model_loaded = True
        return self._model

    def transcribe_wav(self, data: bytes) -> TranscriptionResult:
        raise NotImplementedError("NemoRecognizer inference is implemented in Task 3.")
