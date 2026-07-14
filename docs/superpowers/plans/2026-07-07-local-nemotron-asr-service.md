# Local Nemotron ASR Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local FastAPI service that transcribes uploaded WAV files with NVIDIA Nemotron 3.5 ASR Streaming 0.6B on WSL2 Ubuntu using the local RTX 5060 Ti GPU.

**Architecture:** The ASR service is a separate top-level Python app under `asr-service/`. It exposes `/health` and `/transcribe`, loads the model once, validates WAV uploads, and keeps MeetingRecord app code unchanged until the service is proven locally.

**Tech Stack:** WSL2 Ubuntu 24.04, Python 3.12, FastAPI, Uvicorn, PyTorch CUDA, NVIDIA NeMo ASR, pytest.

## Global Constraints

- RTX 5060 Ti 8GB is enough for one ASR stream, but memory should be treated as constrained.
- Do not run a local LLM summarizer on the same GPU during ASR testing.
- Do not add diarization in the first cut.
- Do not make Cloudflare Pages Functions call local-only services in production code.
- Keep ASR service optional so the existing meeting app still runs without it.
- First cut accepts WAV files only.
- Default language is `zh-CN`.
- Normal tests must not require model weights or GPU inference.

---

## File Structure

- Create `asr-service/README.md`: setup, run, and smoke-test instructions.
- Create `asr-service/requirements.txt`: runtime and test dependencies.
- Create `asr-service/app/__init__.py`: package marker.
- Create `asr-service/app/config.py`: constants for language, device preference, and upload limits.
- Create `asr-service/app/audio.py`: WAV validation and duration extraction.
- Create `asr-service/app/model.py`: lazy model wrapper and injectable fake for tests.
- Create `asr-service/app/main.py`: FastAPI app, `/health`, `/transcribe`.
- Create `asr-service/tests/test_audio.py`: audio validation tests.
- Create `asr-service/tests/test_api.py`: API schema tests using a fake recognizer.

---

### Task 1: WSL Python and CUDA Environment

**Files:**
- No repository files changed.

**Interfaces:**
- Produces: WSL Python environment with `python3.12`, `venv`, `ffmpeg`, `libsndfile1`, and PyTorch CUDA.

- [ ] **Step 1: Install system packages**

Run from Windows PowerShell:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "apt-get update && apt-get install -y python3.12 python3.12-venv python3-pip git ffmpeg libsndfile1"
```

Expected: command exits `0`.

- [ ] **Step 2: Create Python venv**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service && python3.12 -m venv .venv-asr && . .venv-asr/bin/activate && python -m pip install -U pip wheel setuptools"
```

Expected: command exits `0`.

- [ ] **Step 3: Verify Python**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service && . .venv-asr/bin/activate && python --version && pip --version"
```

Expected: Python reports `3.12.x`.

- [ ] **Step 4: Install PyTorch CUDA**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service && . .venv-asr/bin/activate && pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128"
```

Expected: command exits `0`.

- [ ] **Step 5: Verify PyTorch CUDA**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service && . .venv-asr/bin/activate && python -c 'import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))'"
```

Expected: `torch.cuda.is_available()` prints `True` and the GPU name contains `NVIDIA GeForce RTX 5060 Ti`.

---

### Task 2: ASR Service Skeleton and Tests

**Files:**
- Create: `asr-service/requirements.txt`
- Create: `asr-service/app/__init__.py`
- Create: `asr-service/app/config.py`
- Create: `asr-service/app/audio.py`
- Create: `asr-service/app/model.py`
- Create: `asr-service/app/main.py`
- Create: `asr-service/tests/test_audio.py`
- Create: `asr-service/tests/test_api.py`

**Interfaces:**
- Produces: `create_app(recognizer: Recognizer | None = None) -> FastAPI`
- Produces: `validate_wav_bytes(data: bytes) -> AudioInfo`
- Produces: `Recognizer.transcribe_wav(data: bytes) -> TranscriptionResult`

- [ ] **Step 1: Write dependencies**

Create `asr-service/requirements.txt`:

```text
fastapi==0.116.1
uvicorn[standard]==0.35.0
python-multipart==0.0.20
pytest==8.4.1
httpx==0.28.1
```

- [ ] **Step 2: Write failing audio tests**

Create `asr-service/tests/test_audio.py`:

```python
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
```

- [ ] **Step 3: Write failing API tests**

Create `asr-service/tests/test_api.py`:

```python
import io
import wave

from fastapi.testclient import TestClient

from app.main import create_app
from app.model import TranscriptionResult


class FakeRecognizer:
    model_loaded = True
    device = "test"

    def transcribe_wav(self, data: bytes) -> TranscriptionResult:
        return TranscriptionResult(text="测试转写", language="zh-CN")


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
    assert response.json()["text"] == "测试转写"
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
```

- [ ] **Step 4: Run tests to verify failure**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service/asr-service && ../.venv-asr/bin/pip install -r requirements.txt && ../.venv-asr/bin/python -m pytest -q"
```

Expected: tests fail because `app.audio`, `app.main`, and `app.model` do not exist.

- [ ] **Step 5: Implement service skeleton**

Create `asr-service/app/__init__.py`:

```python
"""Local ASR service package."""
```

Create `asr-service/app/config.py`:

```python
DEFAULT_LANGUAGE = "zh-CN"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024
```

Create `asr-service/app/audio.py`:

```python
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
```

Create `asr-service/app/model.py`:

```python
from dataclasses import dataclass
from typing import Protocol

from app.config import DEFAULT_LANGUAGE


@dataclass(frozen=True)
class TranscriptionResult:
    text: str
    language: str = DEFAULT_LANGUAGE


class Recognizer(Protocol):
    model_loaded: bool
    device: str

    def transcribe_wav(self, data: bytes) -> TranscriptionResult:
        ...


class NemoRecognizer:
    model_loaded = False
    device = "cuda"

    def __init__(self) -> None:
        self._model = None

    def _load_model(self):
        if self._model is None:
            import nemo.collections.asr as nemo_asr

            self._model = nemo_asr.models.ASRModel.from_pretrained(
                model_name="nvidia/nemotron-3.5-asr-streaming-0.6b"
            )
            self._model = self._model.to("cuda")
            self.model_loaded = True
        return self._model

    def transcribe_wav(self, data: bytes) -> TranscriptionResult:
        raise NotImplementedError("NemoRecognizer inference is implemented in Task 3.")
```

Create `asr-service/app/main.py`:

```python
from fastapi import FastAPI, File, HTTPException, UploadFile

from app.audio import AudioValidationError, validate_wav_bytes
from app.config import MAX_UPLOAD_BYTES
from app.model import NemoRecognizer, Recognizer


def create_app(recognizer: Recognizer | None = None) -> FastAPI:
    app = FastAPI(title="MeetingRecord Local ASR Service")
    active_recognizer = recognizer or NemoRecognizer()

    @app.get("/health")
    def health():
        return {
            "ok": True,
            "device": active_recognizer.device,
            "modelLoaded": active_recognizer.model_loaded,
        }

    @app.post("/transcribe")
    async def transcribe(file: UploadFile = File(...)):
        if file.content_type not in {"audio/wav", "audio/x-wav", "audio/wave"}:
            raise HTTPException(
                status_code=415,
                detail="Only WAV uploads are supported in the first cut.",
            )

        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Uploaded audio is too large.")

        try:
            info = validate_wav_bytes(data)
        except AudioValidationError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        result = active_recognizer.transcribe_wav(data)
        return {
            "text": result.text,
            "language": result.language,
            "durationSeconds": info.duration_seconds,
        }

    return app


app = create_app()
```

- [ ] **Step 6: Run tests to verify pass**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service/asr-service && ../.venv-asr/bin/python -m pytest -q"
```

Expected: `5 passed`.

- [ ] **Step 7: Commit**

Run:

```powershell
git add asr-service
git -c user.name=Codex -c user.email=codex@local commit -m "feat: scaffold local ASR service"
```

---

### Task 3: Model-backed Transcription

**Files:**
- Modify: `asr-service/app/model.py`
- Modify: `asr-service/requirements.txt`
- Create: `asr-service/README.md`

**Interfaces:**
- Consumes: `NemoRecognizer.transcribe_wav(data: bytes) -> TranscriptionResult`
- Produces: working `/transcribe` endpoint when NeMo and model weights are installed.

- [ ] **Step 1: Add model dependencies note**

Append to `asr-service/requirements.txt`:

```text
Cython
packaging
```

Install NeMo separately because it is pulled from GitHub. PyTorch CUDA must already be installed from Task 1.

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service && . .venv-asr/bin/activate && pip install Cython packaging && pip install 'git+https://github.com/NVIDIA/NeMo.git@main#egg=nemo_toolkit[asr]'"
```

- [ ] **Step 2: Implement temporary-file inference**

Replace `NemoRecognizer.transcribe_wav` in `asr-service/app/model.py`:

```python
    def transcribe_wav(self, data: bytes) -> TranscriptionResult:
        import tempfile
        from pathlib import Path

        model = self._load_model()
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)

        try:
            outputs = model.transcribe([str(tmp_path)], batch_size=1)
        finally:
            tmp_path.unlink(missing_ok=True)

        if isinstance(outputs, list) and outputs:
            text = str(outputs[0])
        else:
            text = str(outputs)

        return TranscriptionResult(text=text, language=DEFAULT_LANGUAGE)
```

- [ ] **Step 3: Run fast tests**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service/asr-service && ../.venv-asr/bin/python -m pytest -q"
```

Expected: existing fake-recognizer tests still pass.

- [ ] **Step 4: Write README**

Create `asr-service/README.md`:

```markdown
# MeetingRecord Local ASR Service

Local FastAPI service for NVIDIA Nemotron 3.5 ASR Streaming 0.6B.

## Setup

```bash
python3.12 -m venv ../.venv-asr
. ../.venv-asr/bin/activate
pip install -U pip wheel setuptools
pip install -r requirements.txt
pip install "git+https://github.com/NVIDIA/NeMo.git@main#egg=nemo_toolkit[asr]"
```

## Run

```bash
. ../.venv-asr/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Smoke Test

```bash
curl http://127.0.0.1:8000/health
curl -F "file=@sample.wav;type=audio/wav" http://127.0.0.1:8000/transcribe
```

The first transcription downloads model weights and can take several minutes.
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add asr-service
git -c user.name=Codex -c user.email=codex@local commit -m "feat: add NeMo transcription path"
```

---

### Task 4: Local Smoke Run

**Files:**
- No required repository files changed.

**Interfaces:**
- Consumes: `uvicorn app.main:app --host 127.0.0.1 --port 8000`
- Produces: verified local ASR service endpoint.

- [ ] **Step 1: Verify CUDA in WSL**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "nvidia-smi"
```

Expected: RTX 5060 Ti appears.

- [ ] **Step 2: Verify PyTorch CUDA**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service && . .venv-asr/bin/activate && python -c 'import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))'"
```

Expected: `True` and RTX 5060 Ti.

- [ ] **Step 3: Start service**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service/asr-service && ../.venv-asr/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000"
```

Expected: Uvicorn listening on `http://127.0.0.1:8000`.

- [ ] **Step 4: Health check from Windows**

Run in another PowerShell:

```powershell
curl.exe http://127.0.0.1:8000/health
```

Expected JSON:

```json
{"ok":true,"device":"cuda","modelLoaded":false}
```

- [ ] **Step 5: Generate a short WAV sample**

Run:

```powershell
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/e/Objects/MeetingRecord/.worktrees/asr-service/asr-service && ../.venv-asr/bin/python - <<'PY'
import math
import wave
from pathlib import Path

path = Path('sample.wav')
sample_rate = 16000
seconds = 1
with wave.open(str(path), 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(sample_rate)
    for i in range(sample_rate * seconds):
        value = int(12000 * math.sin(2 * math.pi * 440 * i / sample_rate))
        wav.writeframesraw(value.to_bytes(2, byteorder='little', signed=True))
print(path.resolve())
PY"
```

Expected: `sample.wav` is created under `asr-service/`.

- [ ] **Step 6: Transcribe a WAV**

Run:

```powershell
curl.exe -F "file=@E:\Objects\MeetingRecord\.worktrees\asr-service\asr-service\sample.wav;type=audio/wav" http://127.0.0.1:8000/transcribe
```

Expected: request reaches the model and returns JSON. A pure sine wave may return empty or low-confidence text; use a spoken-word WAV after this protocol check for real transcription quality.

---

### Task 5: Meeting App Integration Decision

**Files:**
- No changes until the service has passed Task 4.

**Interfaces:**
- Consumes: `POST http://127.0.0.1:8000/transcribe`
- Produces: a follow-up plan for UI upload/record controls.

- [ ] **Step 1: Confirm service behavior**

Verify:

```text
/health works
/transcribe returns Chinese transcript for one WAV
GPU memory stays below 8GB limit
```

- [ ] **Step 2: Decide integration path**

Use `meeting-assistant` for the first UI integration because it has a direct API boundary and simpler meeting content model.

- [ ] **Step 3: Write follow-up spec**

Create a separate design spec before editing frontend files:

```text
docs/superpowers/specs/2026-07-07-meeting-assistant-asr-ui-design.md
```

Scope:

```text
Add audio upload/record controls to MeetingEditor.
Send WAV to local ASR service.
Append transcript to content.
Show service unavailable state.
```
