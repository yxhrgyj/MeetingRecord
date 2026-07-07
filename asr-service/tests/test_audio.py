import io
import wave

import pytest

from app.audio import AudioValidationError, validate_wav_bytes


def make_wav(seconds: float = 0.1, sample_rate: int = 16000) -> bytes:
    frames = int(seconds * sample_rate)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b"\x00\x00" * frames)
    return buffer.getvalue()


def test_validate_wav_bytes_accepts_mono_wav():
    info = validate_wav_bytes(make_wav())
    assert info.channels == 1
    assert info.sample_rate == 16000
    assert 0.09 <= info.duration_seconds <= 0.11


def test_validate_wav_bytes_rejects_non_wav():
    with pytest.raises(AudioValidationError, match="valid WAV"):
        validate_wav_bytes(b"not a wav")
