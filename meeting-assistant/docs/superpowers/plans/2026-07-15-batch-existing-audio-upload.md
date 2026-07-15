# Batch Existing Audio Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let one meeting accept multiple existing audio files, transcribe them serially in a user-controlled order, and produce one summary from the combined transcript.

**Architecture:** Keep the existing 16 MB chunk upload and persisted local-agent jobs unchanged. Add a pure batch coordinator that owns filename ordering and serial state transitions; `MeetingEditor.vue` owns the selected `File` objects and writes completed batch transcripts once in batch order. `MeetingAssistant.vue` renders the batch controls and never starts an AI summary until the batch is fully completed.

**Tech Stack:** Vue 3 composition API, existing local-agent JSON API, Node test runner, Vitest, Vite.

## Global Constraints

- One selected batch represents one meeting and must never create a meeting per audio file.
- MP3, WAV, and WebM keep using the existing 16 MB chunked upload path.
- Files are processed serially; a failed file stops later files until the user retries or removes it.
- Only completed items contribute transcript text. Retrying an item must not duplicate transcript text.
- The final summary stays unavailable while any batch item is selected, uploading, queued, processing, or failed.
- Preserve the existing single-file upload and live-recording flows.

---

### Task 1: Create the pure batch coordinator

**Files:**
- Create: `meeting-assistant/shared/audioBatch.js`
- Test: `meeting-assistant/tests/audio-batch.test.js`

**Interfaces:**
- Consumes: File-like objects with `name`, `size`, and `type`; existing `transcribeUploadedAudio(file, metadata, options)` as an injected async function.
- Produces: `createAudioBatchItems(files)`, `moveAudioBatchItem(items, fromIndex, toIndex)`, `runAudioBatch({ items, transcribeFile, metadata, onItem })`, and `formatCompletedAudioBatch(items)`.

- [ ] **Step 1: Write failing tests for filename ordering and serial execution**

```js
test('creates items in natural filename order', () => {
  const items = createAudioBatchItems([
    { name: 'meeting-10.mp3', size: 1 },
    { name: 'meeting-2.mp3', size: 1 }
  ])
  assert.deepEqual(items.map(item => item.filename), ['meeting-2.mp3', 'meeting-10.mp3'])
})

test('stops the batch after a failed file', async () => {
  const calls = []
  const result = await runAudioBatch({
    items: createAudioBatchItems([{ name: '01.wav', size: 1 }, { name: '02.wav', size: 1 }]),
    transcribeFile: async file => {
      calls.push(file.name)
      throw new Error('ASR offline')
    }
  })
  assert.deepEqual(calls, ['01.wav'])
  assert.equal(result[0].status, 'failed')
  assert.equal(result[1].status, 'selected')
})
```

- [ ] **Step 2: Run the new test file and confirm it fails because the module is absent**

Run: `node --test tests/audio-batch.test.js`

Expected: failure resolving `../shared/audioBatch.js`.

- [ ] **Step 3: Implement the minimal batch model and runner**

```js
export function createAudioBatchItems(files = []) {
  return Array.from(files)
    .filter(file => file?.size > 0)
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))
    .map((file, index) => ({ id: `${index}-${file.name}`, index, filename: file.name, file, status: 'selected', transcript: '', error: '' }))
}

export async function runAudioBatch({ items, transcribeFile, metadata = {}, onItem = () => {} }) {
  const next = items.map(item => ({ ...item }))
  for (const item of next) {
    if (item.status === 'completed') continue
    if (item.status === 'failed') break
    item.status = 'uploading'
    onItem({ ...item })
    try {
      const result = await transcribeFile(item.file, metadata, { onStatus: job => onItem({ ...item, status: job.status }) })
      item.status = 'completed'
      item.transcript = String(result.transcript || '')
      onItem({ ...item })
    } catch (error) {
      item.status = 'failed'
      item.error = error?.message || 'Audio transcription failed.'
      onItem({ ...item })
      break
    }
  }
  return next
}
```

`moveAudioBatchItem` must return a newly indexed list. `formatCompletedAudioBatch` must use completed items sorted by `index` and include each filename as a Markdown heading.

- [ ] **Step 4: Extend tests for move, successful serial processing, and duplicate-safe formatting**

```js
test('formats only completed items in their current order', () => {
  const transcript = formatCompletedAudioBatch([
    { index: 1, filename: '02.wav', status: 'completed', transcript: 'second' },
    { index: 0, filename: '01.wav', status: 'completed', transcript: 'first' },
    { index: 2, filename: '03.wav', status: 'failed', transcript: '' }
  ])
  assert.match(transcript, /01.wav[\s\S]*first[\s\S]*02.wav[\s\S]*second/)
})
```

- [ ] **Step 5: Run the unit test file and commit the isolated batch core**

Run: `node --test tests/audio-batch.test.js`

Expected: all batch tests pass.

```powershell
git add meeting-assistant/shared/audioBatch.js meeting-assistant/tests/audio-batch.test.js
git commit -m "feat: add batch audio transcription coordinator"
```

### Task 2: Integrate batch processing into the meeting editor

**Files:**
- Modify: `meeting-assistant/src/components/MeetingEditor.vue:41-65, 215-263, 615-652, 917-940`
- Modify: `meeting-assistant/src/components/MeetingAssistant.vue:12-39, 65-72, 187-196`
- Test: `meeting-assistant/tests/ui/MeetingEditor.spec.js`
- Test: `meeting-assistant/tests/ui/MeetingAssistant.spec.js`

**Interfaces:**
- Consumes: Task 1 `createAudioBatchItems`, `moveAudioBatchItem`, `runAudioBatch`, and `formatCompletedAudioBatch`.
- Produces: a `batchItems` array in the editor, `chooseAudioBatch`, `startAudioBatch`, `moveBatchItem`, `removeBatchItem`, and `retryBatchItem` handlers; assistant events `batch-upload`, `batch-move`, `batch-remove`, and `batch-retry`.

- [ ] **Step 1: Write failing UI tests for a multi-file selection and summary blocking**

```js
it('shows selected batch files and blocks summary before all are complete', async () => {
  const wrapper = mount(MeetingEditor, { props: { initialData } })
  const input = wrapper.get('input[data-input="audio-batch"]')
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [new File(['a'], '02.wav', { type: 'audio/wav' }), new File(['b'], '01.wav', { type: 'audio/wav' })]
  })
  await input.trigger('change')
  expect(wrapper.text()).toContain('01.wav')
  expect(wrapper.get('[data-action="summarize"]').attributes('disabled')).toBeDefined()
})
```

- [ ] **Step 2: Run the targeted UI test and confirm it fails because the batch picker and list do not exist**

Run: `npm.cmd run test:ui -- MeetingEditor.spec.js`

Expected: selector failure for `input[data-input="audio-batch"]`.

- [ ] **Step 3: Add the batch state and serial processing handlers in `MeetingEditor.vue`**

Create a hidden `multiple` file input accepting `audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/webm,.mp3,.wav,.webm`. On selection, assign `batchItems = createAudioBatchItems(files)`. `startAudioBatch` calls `runAudioBatch` with `localRecording.transcribeUploadedAudio`, passes the meeting title/date/start time, and replaces the matching item through `onItem`.

After every completed state change, rebuild only the batch-owned portion of `form.transcript` from `formatCompletedAudioBatch(batchItems)`. Keep a `batchTranscriptBase` captured before the first batch item starts, so retries replace the batch section rather than append it again.

`retryBatchItem(index)` changes the failed item and all later unstarted items back to `selected`, then calls `startAudioBatch`. `moveBatchItem` and `removeBatchItem` are allowed only before an item has entered `uploading`, `queued`, or `processing`.

- [ ] **Step 4: Add assistant props and controls**

Add `batchItems` and `batchActive` props. Under the existing upload command, add a second command button with `data-action="batch-upload"`, a hidden-input trigger, and a compact ordered list. Each row renders the filename, status, and icon buttons for move up, move down, remove, or retry according to its state. Reuse Lucide `ArrowUp`, `ArrowDown`, `Trash2`, `RotateCcw`, and `Files` icons with accessible labels.

Update `summarizeDisabled` so it is true whenever `batchItems` contains a state other than `completed`.

- [ ] **Step 5: Run the focused UI suite and commit editor integration**

Run: `npm.cmd run test:ui -- MeetingEditor.spec.js MeetingAssistant.spec.js`

Expected: all targeted UI tests pass.

```powershell
git add meeting-assistant/src/components/MeetingEditor.vue meeting-assistant/src/components/MeetingAssistant.vue meeting-assistant/tests/ui/MeetingEditor.spec.js meeting-assistant/tests/ui/MeetingAssistant.spec.js
git commit -m "feat: support batch existing audio uploads"
```

### Task 3: Verify retry behavior and release quality

**Files:**
- Modify: `meeting-assistant/LOCAL_RUN.md` with one concise batch-upload usage note.
- Test: `meeting-assistant/tests/audio-batch.test.js`
- Test: `meeting-assistant/tests/ui/MeetingEditor.spec.js`
- Test: `meeting-assistant/tests/ui/MeetingAssistant.spec.js`

**Interfaces:**
- Consumes: Task 1 batch items and the existing persisted local-agent job list shown by `MeetingEditor.vue`.
- Produces: documented behavior: completed batch items are skipped on retry, while browser-refresh recovery continues through the existing persisted-job list.

- [ ] **Step 1: Add a failing regression test for retrying a failed middle file**

```js
test('resumes from the failed item without reprocessing completed items', async () => {
  const calls = []
  const items = [
    { index: 0, filename: '01.wav', file: { name: '01.wav' }, status: 'completed', transcript: 'one' },
    { index: 1, filename: '02.wav', file: { name: '02.wav' }, status: 'selected', transcript: '' }
  ]
  await runAudioBatch({ items, transcribeFile: async file => { calls.push(file.name); return { transcript: 'two' } })
  assert.deepEqual(calls, ['02.wav'])
})
```

- [ ] **Step 2: Run the batch regression test and confirm it fails before the resume behavior exists**

Run: `node --test tests/audio-batch.test.js`

Expected: failure until `runAudioBatch` skips completed items and resumes at the selected retry item.

- [ ] **Step 3: Complete retry behavior and usage documentation**

Ensure `runAudioBatch` always skips `completed` items. Keep the existing persisted-job list unchanged after a page refresh; it remains the recovery surface for already-uploaded local-agent jobs, while unsubmitted files must be selected again. Add this usage note to `LOCAL_RUN.md`:

```text
For one meeting split across existing files, choose Batch upload existing audio, verify the displayed order, then start processing. Retry any failed file before generating the meeting summary.
```

- [ ] **Step 4: Run all verification commands**

Run:

```powershell
cd E:\Objects\MeetingRecord\.worktrees\release-main\meeting-assistant
npm.cmd test
npm.cmd run build
```

Expected: Node and UI suites pass; Vite writes `dist/` successfully.

- [ ] **Step 5: Commit the completed feature and release it**

```powershell
git add meeting-assistant/shared/audioBatch.js meeting-assistant/src/components/MeetingEditor.vue meeting-assistant/src/components/MeetingAssistant.vue meeting-assistant/tests meeting-assistant/LOCAL_RUN.md
git commit -m "feat: finish batch audio meeting workflow"
git push origin main
```

Deploy the tested `dist` with:

```powershell
$env:HTTPS_PROXY='http://127.0.0.1:10808'
$env:HTTP_PROXY='http://127.0.0.1:10808'
$env:ALL_PROXY='http://127.0.0.1:10808'
npx.cmd wrangler pages deploy dist --project-name meeting-assistant --branch main
```
