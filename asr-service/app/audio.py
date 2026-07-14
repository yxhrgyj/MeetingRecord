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


@dataclass(frozen=True)
class AudioChunk:
    start_seconds: float
    end_seconds: float
    data: bytes


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


def convert_audio_to_wav_bytes(data: bytes, input_suffix: str, label: str) -> bytes:
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        suffix = input_suffix if input_suffix.startswith(".") else f".{input_suffix}"
        input_path = tmp_path / f"input{suffix}"
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
            raise AudioValidationError(f"Upload must be a valid {label} file.") from exc

        return output_path.read_bytes()


def convert_mp3_to_wav_bytes(data: bytes) -> bytes:
    return convert_audio_to_wav_bytes(data, input_suffix=".mp3", label="MP3")


def split_wav_bytes(data: bytes, chunk_seconds: float, overlap_seconds: float) -> list[AudioChunk]:
    if chunk_seconds <= 0:
        raise ValueError("chunk_seconds must be positive.")
    if overlap_seconds < 0 or overlap_seconds >= chunk_seconds:
        raise ValueError("overlap_seconds must be greater than or equal to 0 and smaller than chunk_seconds.")

    try:
        with wave.open(io.BytesIO(data), "rb") as source:
            channels = source.getnchannels()
            sample_width = source.getsampwidth()
            sample_rate = source.getframerate()
            total_frames = source.getnframes()
            frames = source.readframes(total_frames)
    except wave.Error as exc:
        raise AudioValidationError("Upload must be a valid WAV file.") from exc

    chunk_frames = max(1, int(chunk_seconds * sample_rate))
    overlap_frames = int(overlap_seconds * sample_rate)
    step_frames = max(1, chunk_frames - overlap_frames)
    chunks: list[AudioChunk] = []

    for start_frame in range(0, total_frames, step_frames):
        end_frame = min(start_frame + chunk_frames, total_frames)
        start_byte = start_frame * channels * sample_width
        end_byte = end_frame * channels * sample_width
        buffer = io.BytesIO()
        with wave.open(buffer, "wb") as chunk:
            chunk.setnchannels(channels)
            chunk.setsampwidth(sample_width)
            chunk.setframerate(sample_rate)
            chunk.writeframes(frames[start_byte:end_byte])

        chunks.append(
            AudioChunk(
                start_seconds=start_frame / sample_rate if sample_rate else 0,
                end_seconds=end_frame / sample_rate if sample_rate else 0,
                data=buffer.getvalue(),
            )
        )
        if end_frame >= total_frames:
            break

    return chunks
