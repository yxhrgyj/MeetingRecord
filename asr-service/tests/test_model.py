from pathlib import Path

from app.model import NemoRecognizer


class FakeNemoModel:
    def __init__(self) -> None:
        self.paths: list[str] = []

    def transcribe(self, paths: list[str], batch_size: int = 1) -> list[str]:
        self.paths = paths
        assert batch_size == 1
        assert Path(paths[0]).suffix == ".wav"
        return ["recognized text"]


def test_nemo_recognizer_transcribes_wav_bytes_with_loaded_model():
    recognizer = NemoRecognizer()
    fake_model = FakeNemoModel()
    recognizer._model = fake_model
    recognizer.model_loaded = True

    result = recognizer.transcribe_wav(b"fake wav bytes")

    assert result.text == "recognized text"
    assert result.language == "zh-CN"
    assert fake_model.paths
    assert not Path(fake_model.paths[0]).exists()
