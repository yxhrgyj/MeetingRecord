import sys
from pathlib import Path
from types import SimpleNamespace

from app.model import NemoRecognizer


class FakeNemoModel:
    def __init__(self) -> None:
        self.paths: list[str] = []
        self.override_config = None

    def get_transcribe_config(self):
        return SimpleNamespace()

    def transcribe(self, paths: list[str], override_config=None) -> list[str]:
        self.paths = paths
        self.override_config = override_config
        assert Path(paths[0]).suffix == ".wav"
        return [SimpleNamespace(text="recognized text")]


def test_nemo_recognizer_transcribes_wav_bytes_with_loaded_model():
    recognizer = NemoRecognizer()
    fake_model = FakeNemoModel()
    recognizer._model = fake_model
    recognizer.model_loaded = True

    result = recognizer.transcribe_wav(b"fake wav bytes")

    assert result.text == "recognized text"
    assert result.language == "zh-CN"
    assert fake_model.override_config.batch_size == 1
    assert fake_model.override_config.num_workers == 0
    assert fake_model.override_config.target_lang == "zh-CN"
    assert fake_model.override_config.use_lhotse is False
    assert fake_model.override_config.verbose is False
    assert fake_model.paths
    assert not Path(fake_model.paths[0]).exists()


def test_nemo_recognizer_unloads_model_and_releases_cuda_cache(monkeypatch):
    calls = []
    fake_torch = SimpleNamespace(
        cuda=SimpleNamespace(
            is_available=lambda: True,
            empty_cache=lambda: calls.append("empty_cache"),
            ipc_collect=lambda: calls.append("ipc_collect"),
        )
    )
    monkeypatch.setitem(sys.modules, "torch", fake_torch)
    recognizer = NemoRecognizer()
    recognizer._model = object()
    recognizer.model_loaded = True

    recognizer.unload_model()

    assert recognizer._model is None
    assert recognizer.model_loaded is False
    assert calls == ["empty_cache", "ipc_collect"]
