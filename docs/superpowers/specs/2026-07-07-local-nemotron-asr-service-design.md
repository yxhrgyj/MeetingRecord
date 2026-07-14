# Local Nemotron ASR Service Design

Date: 2026-07-07
Workspace: E:\Objects\MeetingRecord
Branch: feature/asr-service

## Goal

Add a local speech-to-text service for MeetingRecord using NVIDIA Nemotron 3.5 ASR Streaming 0.6B. The service runs on the user's Windows desktop through WSL2 Ubuntu and uses the local NVIDIA GeForce RTX 5060 Ti 8GB GPU.

The first working milestone is a minimal HTTP transcription service:

- Accept a WAV audio file.
- Run ASR locally.
- Return recognized text.
- Keep MeetingRecord unchanged until the ASR service is independently verified.

Real-time browser microphone streaming is a second milestone, not part of the first service cut.

## Current Environment Findings

- Repository is now isolated in `.worktrees/asr-service`.
- Existing `meeting-assistant` API baseline passes: 8 tests, 0 failures.
- Windows NVIDIA driver is visible through `nvidia-smi`.
- GPU: NVIDIA GeForce RTX 5060 Ti, 8151 MiB VRAM.
- Ubuntu 24.04 package is installed through `winget`.
- Windows optional features `Microsoft-Windows-Subsystem-Linux` and `VirtualMachinePlatform` have been enabled.
- Ubuntu registration currently fails before reboot with `WslRegisterDistribution failed with error: 0x80071772`.

Expected next environment step: restart Windows, then rerun Ubuntu registration and verify `wsl -l -v`.

## Architecture

```text
MeetingRecord frontend
  -> HTTP or WebSocket
Local ASR service on localhost
  -> FastAPI
  -> PyTorch CUDA
  -> NVIDIA NeMo
  -> nvidia/nemotron-3.5-asr-streaming-0.6b
MeetingRecord storage
  -> existing meeting content/notes fields
```

The ASR service is a separate local process. It is not deployed to Cloudflare Pages Functions, because Cloudflare Functions cannot run this GPU/PyTorch workload.

## Components

### asr-service

New top-level service directory:

```text
asr-service/
  README.md
  requirements.txt
  app/
    __init__.py
    main.py
    model.py
    audio.py
```

Responsibilities:

- Load the ASR model once at process startup.
- Expose a health endpoint.
- Accept audio upload for batch transcription.
- Convert or validate audio input into model-compatible format.
- Return JSON responses with transcript text and basic timing metadata.

### MeetingRecord integration

Initial integration target: `meeting-assistant`, because it already has an API boundary and Cloudflare/D1 shape.

The first integration should be local-only:

- Add frontend control to upload or record audio.
- Send audio to `http://localhost:8000/transcribe`.
- Append returned transcript to the meeting `content` field.

No Cloudflare deployment changes are required for the first cut.

## API Design

### GET /health

Returns:

```json
{
  "ok": true,
  "device": "cuda",
  "modelLoaded": true
}
```

### POST /transcribe

Request:

- `multipart/form-data`
- field: `file`
- accepted first cut: WAV file

Response:

```json
{
  "text": "recognized transcript",
  "language": "zh-CN",
  "durationSeconds": 12.34
}
```

First-cut defaults:

- Language: `zh-CN`
- Batch size: `1`
- Device: `cuda`
- One request at a time unless measured otherwise.

## Later Streaming API

Streaming is deferred until file transcription is stable.

Candidate endpoint:

```text
WebSocket /stream
```

Data flow:

- Browser captures microphone audio.
- Browser sends small audio chunks to FastAPI WebSocket.
- ASR service returns partial and final transcript messages.
- Frontend appends final chunks into the current meeting note.

## Error Handling

The ASR service should return explicit errors:

- `400` for missing or unsupported audio file.
- `415` for unsupported media type.
- `503` when model is not loaded or CUDA is unavailable.
- `500` for unexpected inference errors.

Large model startup failures should be logged once and exposed through `/health`.

## Testing

Baseline already verified:

```text
meeting-assistant: npm.cmd test
8 tests passed
```

ASR service tests to add:

- Unit test for audio validation.
- Unit test for response schema.
- Smoke test for `/health`.
- Manual GPU smoke test for one short WAV file.

Model inference tests should not run in normal CI because they require a local GPU and downloaded model weights.

## Implementation Order

1. Finish WSL2 Ubuntu registration after reboot.
2. Verify `nvidia-smi` inside WSL.
3. Create Python virtual environment.
4. Install PyTorch CUDA and verify `torch.cuda.is_available()`.
5. Install NeMo ASR.
6. Create `asr-service` FastAPI skeleton.
7. Implement `/health`.
8. Implement `/transcribe` for WAV files.
9. Run local smoke transcription.
10. Add minimal frontend integration only after service is proven.

## Constraints

- RTX 5060 Ti 8GB is enough for one ASR stream, but memory should be treated as constrained.
- Do not run a local LLM summarizer on the same GPU during ASR testing.
- Do not add diarization in the first cut.
- Do not make Cloudflare Pages Functions call local-only services in production code.
- Keep ASR service optional so the existing meeting app still runs without it.
