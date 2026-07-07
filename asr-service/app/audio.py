from dataclasses import dataclass
import io
import wave


class AudioValidationError(ValueError):
    pass


@dataclass(frozen=True)
class AudioInfo:
    channels: int
    sample_rate: int
    duration_seconds: float


def validate_wav_bytes(data: bytes) -> AudioInfo:
    try:
        with wave.open(io.BytesIO(data), "rb") as wav:
            channels = wav.getnchannels()
            sample_rate = wav.getframerate()
            frames = wav.getnframes()
    except wave.Error as exc:
        raise AudioValidationError("Upload must be a valid WAV file.") from exc

    duration = frames / sample_rate if sample_rate else 0.0
    return AudioInfo(channels=channels, sample_rate=sample_rate, duration_seconds=duration)
