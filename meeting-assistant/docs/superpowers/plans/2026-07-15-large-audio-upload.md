# Large Audio Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support cloud-accessible large audio uploads, asynchronous local transcription, persisted retries, and reuse of existing recordings.

**Architecture:** Upload the browser file in bounded 16 MB chunks through `/api/local`, assemble it on the local model host, and persist a retryable job. Send the assembled source to a streamed ASR endpoint, then reuse the existing ordered transcript and staged summary pipeline.

**Tech Stack:** Vue 3, Express, Node.js, Cloudflare Pages Functions, FastAPI, Python, ffmpeg, Ollama `qwen3.5:9b`.

## Global Constraints

- Do not restart or deploy formal services during implementation.
- Keep audio on the local model host; do not store audio in D1 or Cloudflare.
- Keep each cloud transport request below the provider body limit using 16 MB chunks.
- Preserve existing recording directories and allow retry from existing `meeting.webm` files.
- Production code is added only after a failing test is observed.

## Task 1: Persisted Upload Storage

**Files:** `server/localRecording.js`, `tests/local-recording.test.js`

- [x] Add upload-session metadata, numbered transport-part storage, contiguous validation, and original-file assembly.
- [x] Test out-of-order arrival and exact byte reassembly.
- [x] Keep the original assembled source beside `job.json`.

## Task 2: Async Upload Jobs and HTTP API

**Files:** `server/localRecording.js`, `server.js`, `tests/local-recording.test.js`

- [x] Add upload start, chunk, finish, status, list, and retry operations.
- [x] Reuse the existing persisted job state machine and ASR-only behavior.
- [x] Verify the bounded upload flow with the `3011` backup HTTP smoke.

## Task 3: Streamed ASR Entry

**Files:** `asr-service/app/config.py`, `asr-service/app/main.py`, `asr-service/tests/test_api.py`

- [x] Add `/transcribe-file` with metadata validation and a 1 GiB stream limit.
- [x] Reuse existing format conversion, timestamp segmentation, and model cleanup.
- [x] Preserve the legacy `/transcribe` endpoint.

## Task 4: Client and Recovery UI

**Files:** `src/composables/useLocalRecording.js`, `src/components/MeetingEditor.vue`, `src/components/MeetingAssistant.vue`, corresponding tests

- [x] Upload files in 16 MB chunks and poll the persisted job.
- [x] Route selected audio through the local upload job and append the returned transcript.
- [x] List persisted active/failed jobs and expose retry without re-uploading.

## Task 5: Verification and Release Handoff

**Files:** `PROJECT_PROGRESS.md`, design/spec documentation

- [x] Run Node, UI, Python, syntax, build, diff, and backup HTTP checks.
- [x] Confirm formal ports were not restarted and no deployment command ran.
- [ ] Perform a real GPU/Cloudflare acceptance test after an explicitly approved local restart and formal deployment.
