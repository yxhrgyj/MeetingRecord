# Meeting Summary and Transcript Tabs Design

**Date:** 2026-07-14
**Status:** User-approved design
**Target:** `meeting-assistant` on `feature/asr-service`

## 1. Objective

Make the organized meeting minutes the primary reading surface. The complete speech transcript remains available for checking details, but it no longer pushes the minutes below a long source transcript.

The approved interaction is a lightweight two-option segmented control:

```text
会议纪要  |  完整转写
```

`会议纪要` is the default view. `完整转写` is an evidence and detail view opened only when needed.

## 2. Product Decisions

- Meeting minutes and the complete transcript appear as two views inside the existing meeting document, not as two documents or two database records.
- Opening an existing meeting defaults to `会议纪要`.
- Generating minutes automatically selects `会议纪要` and scrolls the document to the top.
- Recording and audio upload write only to `完整转写`.
- Regenerating minutes replaces only the minutes section and never changes the transcript.
- AI summarization uses the transcript as its source. Existing minutes must not be sent back as source text during regeneration.
- Editing and read-only detail use the same tab order and section boundaries.
- The right assistant rail, recording flow, API routes and cloud deployment model remain unchanged.

## 3. User Experience

### 3.1 Placement

Place the segmented control inside the white document, below the meeting metadata and attendees and above the section content. It uses the existing Apple-like control language: compact height, subtle gray track, white selected item, hairline separation and clear keyboard focus.

The formatting toolbar remains visible only for the active editable section. Switching tabs does not open another page or move the assistant rail.

### 3.2 Meeting minutes view

The minutes view is optimized for reading and editing conclusions, decisions and action items. It opens at the top of the section rather than preserving a scroll position from the long transcript.

If minutes do not exist:

- Edit mode shows `尚未生成会议纪要`, a primary `整理会议纪要` action and a secondary `查看完整转写` action.
- Read mode shows `该会议尚未整理纪要` and a `查看完整转写` action.
- If no transcript exists either, the message becomes `暂无会议内容` and the organize action remains disabled.

### 3.3 Complete transcript view

The transcript view contains the full ASR output, including timestamps when available. It remains editable so recognition errors can be corrected before minutes are regenerated.

Recording or audio upload completion selects this view only when the operation produced a transcript without minutes. If the recording pipeline returns both transcript and minutes, the final view is `会议纪要`.

### 3.4 Responsive behavior

- Desktop and tablet show the segmented control at the document width; the assistant rail or drawer behavior does not change.
- Mobile keeps the two labels on one row with equal-width touch targets.
- Switching sections must not create horizontal overflow or move the document header.

## 4. Content Compatibility

The first implementation does not add D1 columns or change the public meeting API. The existing `content` string remains the persistence and export boundary.

Introduce two focused helpers:

- `parseMeetingContent(content)` returns `{ summary, transcript }`.
- `serializeMeetingContent({ summary, transcript })` returns deterministic Markdown.

The canonical serialized form is:

```markdown
## 会议纪要

<organized minutes>

---

## 完整转写

<full transcript>
```

Compatibility rules:

1. Canonical `会议纪要` and `完整转写` headings are parsed directly.
2. Existing content containing `## 会议纪要草稿` is split at that marker: text before it is the transcript and the marked section is the minutes.
3. Existing unmarked content is treated as legacy minutes so previously handwritten records still open in the primary view.
4. New ASR output is serialized immediately into the transcript section, so a transcript-only meeting remains distinguishable after reload.
5. Saving after any edit writes the canonical format. No destructive bulk migration is required.

Markdown and DOCX exports continue using the stored `content`. The canonical order places minutes first and transcript second, so exported documents also become useful without scrolling through the source transcript first.

## 5. Component Boundaries

### `MeetingDocument`

- Receives the active `summary` or `transcript` section as controlled state.
- Renders the segmented control, empty states and the active content surface.
- Emits section-selection and section-specific content updates instead of treating the document as one undifferentiated textarea.

### `MeetingEditor`

- Holds `summary` and `transcript` form state derived from `parseMeetingContent`.
- Owns the active section in edit mode so successful ASR and summarization can select the correct view.
- Sends the transcript to the summarizer.
- Routes ASR and recording results to the transcript.
- Serializes both sections before autosave, manual save and export eligibility checks.

### Content section helper

- Contains parsing, legacy compatibility and serialization only.
- Has no Vue, API or browser dependencies and can be covered by fast unit tests.

### `MeetingDetail`

- Uses the same document control in read mode.
- Owns the active section in read mode, initialized to `summary`.
- Defaults to minutes and allows switching to the transcript without entering edit mode.

## 6. State and Data Flow

### Recording or audio upload

1. ASR returns transcript text.
2. Append the text to `transcript` with the existing timestamp formatting.
3. Preserve `summary` unchanged.
4. If no minutes were returned, select `完整转写` so the new result is visible.

### Organize minutes

1. Reject the action when `transcript.trim()` is empty.
2. Send only `transcript` to `/api/summarize`.
3. On success, remove one known leading `会议纪要` or legacy `会议纪要草稿` wrapper heading from the model response, then replace `summary` with the normalized minutes.
4. Select `会议纪要`, scroll its surface to the top and show `纪要已生成` in the assistant rail.
5. Serialize both sections during the next save without changing the transcript.

### Regenerate minutes

Regeneration repeats the organize flow and replaces the current minutes only. It does not append another draft and does not summarize the previous summary.

## 7. Errors and Edge Cases

- Summary failure keeps both sections in memory and leaves the current tab unchanged.
- A retry action reruns summarization from the current transcript.
- Empty transcript disables organization and explains `没有可整理的完整转写`.
- Deleting all minutes returns the minutes view to its empty state without deleting the transcript.
- Deleting all transcript text never removes existing minutes, but regeneration remains disabled.
- Legacy parsing must be conservative: when content cannot be split confidently, preserve all text as legacy minutes rather than risk data loss.

## 8. Accessibility

- The segmented control exposes a labeled tab list or equivalent radio-group semantics.
- Each option exposes selected state and can be reached by keyboard.
- Focus remains visible, and switching tabs moves focus to the selected tab without forcing focus into the textarea.
- Empty-state actions have explicit names; color is not the only selected-state indicator.

## 9. Verification

### Unit tests

- Canonical content parses and round-trips without loss.
- Legacy transcript plus `会议纪要草稿` splits correctly.
- Unmarked legacy content is preserved as minutes.
- Recording appends only to transcript.
- Regeneration replaces only minutes and sends only transcript to the summarizer.

### Component tests

- Minutes are selected by default in edit and read modes.
- Tabs switch the visible section without changing the assistant rail.
- Empty states and disabled organization reasons are correct.
- Successful organization selects minutes and shows the result.

### Browser checks

- A long transcript does not require scrolling to reach minutes.
- Create, record/upload, organize, switch sections, save, reopen and edit all preserve both sections.
- `1440x900`, `1280x800` and `390x844` have no clipping or horizontal overflow.
- Existing legacy meetings remain readable before and after their first save.

## 10. Non-goals

- No database schema migration.
- No separate transcript table, version history or speaker editor.
- No side-by-side transcript comparison.
- No change to ASR, Ollama, Cloudflare Tunnel, authentication or deployment.
- No cloud deployment as part of this design task.
