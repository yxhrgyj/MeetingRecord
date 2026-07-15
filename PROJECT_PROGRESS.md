# MeetingRecord Worktree Progress

## Current Status

- Long-meeting local flow implemented in `meeting-assistant/`.
- Recording segments finish as ASR-only queued jobs; the UI can start the next segment while prior segments are queued or processing.
- Completed transcripts are merged by recording index.
- Long summaries use 3000-5000 character chunks, sequential stage summaries, and one final summary request.
- Large existing-audio uploads use 16 MB transport chunks, local source assembly, persisted ASR jobs, and retryable recovery through the same `/api/local` path used by the cloud frontend.
- ASR exposes `/transcribe-file` for streamed local-gateway uploads; the legacy `/transcribe` endpoint remains for compatibility.
- Local model remains `qwen3.5:9b`.

## Verification Baseline

- `meeting-assistant/npm.cmd test`: Node 80/80 and UI 38/38 passed.
- `asr-service`: Python 17/17 passed; Python bytecode compilation passed.
- `meeting-assistant/npm.cmd run build`: passed.
- Backup HTTP smoke on `3011` passed: upload session creation, raw chunk upload, source assembly, and queued background job all returned expected responses.
- Formal services on `3001`, `8789`, and `11434` were not restarted or modified. No formal deployment command was run.

## Open Risks

- A real 84 MB, approximately 87-minute recording was retried successfully through the local app: 89 ordered ASR segments and a 28,273-character transcript were produced.
- The same transcript completed 10 stage-summary requests plus one final merge through `qwen3.5:9b`; the final summary contained 1,808 characters.
- Legacy records using `会议详情` or `语音转写原文` now load into the transcript section, while `整理的纪要` remains in the minutes section.
- Formal Pages deployment and formal service restart remain pending explicit user approval.

## Next Step

Run a real local two-segment meeting from the browser and confirm the UI displays completed transcripts in recording order. Keep formal deployment and service restarts as a separate release step; do not deploy until explicitly requested.

## Change Log

- 2026-07-15: Added long-meeting design and implementation plan.
- 2026-07-15: Added ASR-only segment queueing, status polling, retry, ordered transcript merge, stage summaries, final summary, UI status list, and local-only verification.
- 2026-07-15: Added bounded cloud upload chunks, persisted upload assembly, streamed ASR processing, persisted-job recovery UI, and retry support for existing recordings; verified locally without formal restart or deployment.
- 2026-07-15: Verified the existing 84 MB, approximately 87-minute recording by retrying ASR locally; verified ordered transcript output and the full 10-stage plus final `qwen3.5:9b` summary flow.
- 2026-07-15: Fixed legacy content parsing so meeting details and raw transcript appear only in the transcript tab; added domain and UI regression coverage.
