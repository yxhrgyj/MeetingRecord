# Existing Audio Batch Upload Design

## Goal

Allow users to select multiple existing audio files that belong to one meeting, transcribe them in their intended order, then generate one meeting summary from the combined transcript.

## User Flow

1. In the meeting assistant, the user chooses "Batch upload existing audio" and selects one or more MP3, WAV, or WebM files.
2. The app displays a batch list before processing. Files use natural filename order by default; the user can move an item up or down or remove it.
3. Starting the batch uploads and queues one file at a time through the existing chunked local-agent upload API. The next file starts after the previous file has been accepted and queued, so the local ASR service is not overloaded.
4. Each item shows queued, transcribing, completed, or failed. A failed item can be retried without re-uploading successful items.
5. Completed transcripts are merged in the batch-list order into the meeting transcript. The AI summary command remains disabled until every batch item is completed. It then produces one final meeting summary from the merged transcript.

## Boundaries

- A batch represents one meeting. The app never creates separate meeting records for individual audio files.
- Existing single-file upload remains available and uses the same upload pipeline.
- Browser-side audio concatenation is not used. Each source file is uploaded in 16 MB chunks, assembled and transcribed by the local agent, matching the existing large-audio path.
- The batch state is retained in the editor while the page is open. After a refresh, the existing persisted-job list continues to expose queued and failed local-agent jobs for retry; files that were selected but not yet uploaded must be selected again.
- The meeting transcript is changed only when an item reaches completed. Retries do not append duplicate transcript content.

## Components

- `src/composables/useLocalRecording.js` gains a batch helper that sorts files, invokes the existing `transcribeUploadedAudio` method serially, and reports per-file status and progress through callbacks.
- `src/components/MeetingEditor.vue` owns the selected batch, maps completed items to ordered transcript segments, and passes batch state and actions to the assistant.
- `src/components/MeetingAssistant.vue` exposes the multiple-file picker and renders the ordered batch list with move, remove, retry, and status controls.
- `shared/longMeeting.js` provides a small pure helper for natural filename ordering and deterministic formatting of completed batch transcripts if that avoids duplicating ordering rules in the UI.

## Failure Handling

- Invalid or empty files fail before a batch begins and do not block valid selections.
- Upload or ASR failure marks only the affected item failed. The remaining unstarted items are not submitted until the user retries or removes the failed item, preserving the selected order.
- The final summary is blocked while any item is queued, transcribing, or failed. The UI states which item needs attention.

## Verification

- Unit tests cover natural ordering, serial execution, a failed middle file, retry without duplicate transcript text, and summary blocking.
- UI tests cover selecting multiple files, moving an item, showing item states, and enabling summary only after all items complete.
- Existing Node, UI, and production-build checks remain required before deployment.
