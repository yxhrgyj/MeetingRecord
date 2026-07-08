# MeetingRecord Local ASR Service

Local FastAPI service for NVIDIA Nemotron 3.5 ASR Streaming 0.6B.

## Setup

```bash
python3.12 -m venv ../.venv-asr
. ../.venv-asr/bin/activate
pip install -U pip wheel setuptools
pip install -r requirements.txt
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple "nemo_toolkit[asr]==2.7.3"
pip install --no-deps --force-reinstall "git+https://github.com/NVIDIA-NeMo/Speech.git@main"
```

## Run

```bash
. ../.venv-asr/bin/activate
HF_ENDPOINT=https://hf-mirror.com uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Smoke Test

```bash
curl http://127.0.0.1:8000/health
curl -F "file=@sample.wav;type=audio/wav" http://127.0.0.1:8000/transcribe
```

The first transcription downloads model weights and can take several minutes.
