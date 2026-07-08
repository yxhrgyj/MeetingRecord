import io
import wave

import pytest

from app.audio import AudioValidationError, split_wav_bytes, validate_wav_bytes


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


def test_split_wav_bytes_returns_overlapping_valid_chunks():
    chunks = split_wav_bytes(make_wav(seconds=2.2), chunk_seconds=1.0, overlap_seconds=0.2)

    assert len(chunks) == 3
    assert chunks[0].start_seconds == 0
    assert 0.99 <= chunks[0].end_seconds <= 1.01
    assert 0.79 <= chunks[1].start_seconds <= 0.81
    assert 1.79 <= chunks[1].end_seconds <= 1.81
    assert 1.59 <= chunks[2].start_seconds <= 1.61
    assert 2.19 <= chunks[2].end_seconds <= 2.21
    assert all(validate_wav_bytes(chunk.data).sample_rate == 16000 for chunk in chunks)
