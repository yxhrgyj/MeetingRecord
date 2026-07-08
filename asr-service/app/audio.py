from dataclasses import dataclass
import io
import subprocess
import tempfile
from pathlib import Path
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


def convert_mp3_to_wav_bytes(data: bytes) -> bytes:
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        input_path = tmp_path / "input.mp3"
        output_path = tmp_path / "output.wav"
        input_path.write_bytes(data)

        try:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-i",
                    str(input_path),
                    "-ac",
                    "1",
                    "-ar",
                    "16000",
                    str(output_path),
                ],
                check=True,
                capture_output=True,
            )
        except (FileNotFoundError, subprocess.CalledProcessError) as exc:
            raise AudioValidationError("Upload must be a valid MP3 file.") from exc

        return output_path.read_bytes()
