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
        self.calls = 0
        self.events: list[str] = []

    def transcribe_wav(self, data: bytes) -> TranscriptionResult:
        self.last_data = data
        self.calls += 1
        self.events.append(f"transcribe:{self.calls}")
        return TranscriptionResult(text="test transcript", language="zh-CN")

    def unload_model(self) -> None:
        self.events.append("unload")
        self.model_loaded = False


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


def test_root_reports_available_endpoints():
    client = TestClient(main_module.create_app(FakeRecognizer()))
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "MeetingRecord Local ASR Service"
    assert "/health" in response.json()["endpoints"]
    assert "/transcribe" in response.json()["endpoints"]


def test_cors_allows_local_meeting_assistant():
    client = TestClient(main_module.create_app(FakeRecognizer()))
    response = client.options(
        "/transcribe",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


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
    assert response.json()["segments"][0]["text"] == "test transcript"


def test_transcribe_returns_timestamped_segments_for_long_upload(monkeypatch):
    recognizer = FakeRecognizer()
    monkeypatch.setattr(main_module, "TRANSCRIBE_CHUNK_SECONDS", 1.0)
    monkeypatch.setattr(main_module, "TRANSCRIBE_OVERLAP_SECONDS", 0.2)
    client = TestClient(main_module.create_app(recognizer))

    response = client.post(
        "/transcribe",
        files={"file": ("sample.wav", make_wav(seconds=2.2), "audio/wav")},
    )

    assert response.status_code == 200
    body = response.json()
    assert recognizer.calls == 3
    assert len(body["segments"]) == 3
    assert body["segments"][0]["startSeconds"] == 0
    assert 0.79 <= body["segments"][1]["startSeconds"] <= 0.81
    assert body["text"] == "test transcript\n\ntest transcript\n\ntest transcript"


def test_transcribe_unloads_recognizer_after_all_chunks(monkeypatch):
    recognizer = FakeRecognizer()
    monkeypatch.setattr(main_module, "TRANSCRIBE_CHUNK_SECONDS", 1.0)
    monkeypatch.setattr(main_module, "TRANSCRIBE_OVERLAP_SECONDS", 0.2)
    client = TestClient(main_module.create_app(recognizer))

    response = client.post(
        "/transcribe",
        files={"file": ("sample.wav", make_wav(seconds=2.2), "audio/wav")},
    )

    assert response.status_code == 200
    assert recognizer.events == ["transcribe:1", "transcribe:2", "transcribe:3", "unload"]
    assert recognizer.model_loaded is False


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
