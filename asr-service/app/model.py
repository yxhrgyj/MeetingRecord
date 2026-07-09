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

    def unload_model(self) -> None:
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

    def unload_model(self) -> None:
        if self._model is None:
            self.model_loaded = False
            return

        self._model = None
        self.model_loaded = False

        import gc

        gc.collect()

        try:
            import torch

            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
        except Exception:
            pass

    def transcribe_wav(self, data: bytes) -> TranscriptionResult:
        import tempfile
        from pathlib import Path

        model = self._load_model()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)

        try:
            config = model.get_transcribe_config()
            config.batch_size = 1
            config.num_workers = 0
            config.target_lang = DEFAULT_LANGUAGE
            config.use_lhotse = False
            config.verbose = False
            outputs = model.transcribe([str(tmp_path)], override_config=config)
        finally:
            tmp_path.unlink(missing_ok=True)

        if isinstance(outputs, list) and outputs:
            first_output = outputs[0]
            text = str(getattr(first_output, "text", first_output))
        else:
            text = str(outputs)

        return TranscriptionResult(text=text, language=DEFAULT_LANGUAGE)
