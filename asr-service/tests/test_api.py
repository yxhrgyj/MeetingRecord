import io
import wave

from fastapi.testclient import TestClient

import app.main as main_module
from app.audio import validate_wav_bytes
from app.model import TranscriptionResult


class FakeRecognizer:
    model_loaded = True
    device = "test"

    def __init__(self) -> None:
        self.last_data: bytes | None = None

    def transcribe_wav(self, data: bytes) -> TranscriptionResult:
        self.last_data = data
        return TranscriptionResult(text="test transcript", language="zh-CN")


def make_wav(seconds: float = 0.1) -> bytes:
    frames = int(seconds * 16000)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x00\x00" * frames)
    return buffer.getvalue()


def test_health_reports_model_status():
    client = TestClient(main_module.create_app(FakeRecognizer()))
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True, "device": "test", "modelLoaded": True}


def test_transcribe_returns_text_for_wav_upload():
    client = TestClient(main_module.create_app(FakeRecognizer()))
    response = client.post(
        "/transcribe",
        files={"file": ("sample.wav", make_wav(), "audio/wav")},
    )
    assert response.status_code == 200
    assert response.json()["text"] == "test transcript"
    assert response.json()["language"] == "zh-CN"
    assert response.json()["durationSeconds"] > 0


def test_transcribe_converts_mp3_upload(monkeypatch):
    converted_wav = make_wav(seconds=0.2)
    recognizer = FakeRecognizer()
    monkeypatch.setattr(main_module, "convert_mp3_to_wav_bytes", lambda data: converted_wav)
    client = TestClient(main_module.create_app(recognizer))

    response = client.post(
        "/transcribe",
        files={"file": ("sample.mp3", b"fake mp3", "audio/mpeg")},
    )

    assert response.status_code == 200
    assert response.json()["text"] == "test transcript"
    assert 0.19 <= response.json()["durationSeconds"] <= 0.21
    assert recognizer.last_data == converted_wav
    assert validate_wav_bytes(recognizer.last_data).sample_rate == 16000


def test_transcribe_rejects_non_wav_upload():
    client = TestClient(main_module.create_app(FakeRecognizer()))
    response = client.post(
        "/transcribe",
        files={"file": ("bad.txt", b"bad", "text/plain")},
    )
    assert response.status_code == 415
    assert response.json()["detail"] == "Only WAV and MP3 uploads are supported."
