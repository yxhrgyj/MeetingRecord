# Large Audio Upload Design

## Goal

Allow audio files longer than one hour to be uploaded from the cloud page, transcribed asynchronously, retried after failure, and reused for later meeting-minute generation without storing audio in Cloudflare.

## Architecture

The browser sends the selected file as 16 MB transport chunks to `/api/local/uploads/*`. On a deployed page, the Pages Function forwards each bounded request through the authenticated model gateway and Tunnel to the local Express agent. The agent stores the chunks under the existing `recordings/<id>/` directory, reassembles the original file, and persists a `job.json` task.

The local agent sends the assembled source to ASR through `/transcribe-file` as a streamed request. The ASR service validates the file, converts MP3/WebM to normalized WAV, reuses its timestamped recognition chunks, and returns the ordered transcript. The source file and job metadata remain on the local model computer; only transcript and meeting content are saved to the application database.

## User Flow

1. Select an MP3, WAV, or WebM file.
2. Upload bounded chunks with progress.
3. Queue background transcription and poll `job.json` status.
4. Append the ordered transcript to the editor when complete.
5. Generate the existing staged summary and final meeting minutes.
6. On a later page load, show persisted failed/active jobs and allow retry without re-uploading the source.

## Error Handling

- Missing or out-of-order upload chunks fail before an ASR job is queued.
- Unsupported extensions return a clear 415-style error.
- ASR failures preserve the original source and failed `job.json` state.
- Retry reuses the assembled source and creates no duplicate recording directory.
- Cloud requests stay below the single-request body limit; the local host and Tunnel must remain online for processing.

## Verification

- Node tests cover chunk ordering, upload jobs, file-stream ASR requests, client chunking, listing, and retry.
- Python tests cover the raw streamed ASR endpoint and existing multipart compatibility.
- UI tests cover persisted recovery controls and uploaded transcript insertion.
- Local backup HTTP smoke uses ports `3011` and `8790` only; formal services and deployment remain untouched.
