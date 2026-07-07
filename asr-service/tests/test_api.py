import io
import wave

from fastapi.testclient import TestClient

from app.main import create_app
from app.model import TranscriptionResult


class FakeRecognizer:
    model_loaded = True
    device = "test"

    def transcribe_wav(self, data: bytes) -> TranscriptionResult:
        return TranscriptionResult(text="test transcript", language="zh-CN")


def make_wav() -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(16000)
        wav.writeframes(b"\x00\x00" * 1600)
    return buffer.getvalue()


def test_health_reports_model_status():
    client = TestClient(create_app(FakeRecognizer()))
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True, "device": "test", "modelLoaded": True}


def test_transcribe_returns_text_for_wav_upload():
    client = TestClient(create_app(FakeRecognizer()))
    response = client.post(
        "/transcribe",
        files={"file": ("sample.wav", make_wav(), "audio/wav")},
    )
    assert response.status_code == 200
    assert response.json()["text"] == "test transcript"
    assert response.json()["language"] == "zh-CN"
    assert response.json()["durationSeconds"] > 0


def test_transcribe_rejects_non_wav_upload():
    client = TestClient(create_app(FakeRecognizer()))
    response = client.post(
        "/transcribe",
        files={"file": ("bad.txt", b"bad", "text/plain")},
    )
    assert response.status_code == 415
    assert response.json()["detail"] == "Only WAV uploads are supported in the first cut."
