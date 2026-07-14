# Summary-First Meeting Document Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make meeting minutes the default document view and expose the complete speech transcript through an on-demand tab without changing the meeting API or database schema.

**Architecture:** Add a pure Markdown section codec that maps the existing `content` string to `{ summary, transcript }`, then keep those sections as controlled state in `MeetingEditor` and `MeetingDetail`. `MeetingDocument` renders a reusable accessible segmented control and one active section at a time; saves and exports serialize both sections back into the existing `content` field.

**Tech Stack:** Vue 3 Composition API, Vite, Tailwind CSS, Vitest, Vue Test Utils, Node Test Runner, Playwright, existing Express/Cloudflare meeting API.

---

## Execution constraints

- Work in `E:\Objects\MeetingRecord\.worktrees\asr-service\meeting-assistant` on `feature/asr-service`.
- Read `E:\Objects\MeetingRecord\PROJECT_PROGRESS.md` and run `git status --short` before editing.
- `src/App.vue` and the ASR/model-gateway files already contain unrelated user changes. Do not stage, replace or revert them.
- Use `apply_patch` for edits and stage only the files named in each task.
- Follow red-green-refactor: every behavior change starts with a failing focused test.
- Do not deploy. Cloud deployment requires a separate explicit user request.

## File structure

| File | Responsibility |
|---|---|
| `src/domain/meetingContent.js` | Pure parse, normalize and serialize functions for canonical and legacy meeting content |
| `tests/meeting-content.test.js` | Codec round-trip and compatibility tests |
| `src/components/MeetingContentTabs.vue` | Accessible `会议纪要 / 完整转写` segmented control |
| `tests/ui/MeetingContentTabs.spec.js` | Tab semantics and selection events |
| `src/components/MeetingDocument.vue` | Meeting metadata plus the active summary/transcript editing or reading surface |
| `tests/ui/MeetingDocument.spec.js` | Controlled-section rendering, empty states and editing events |
| `src/components/MeetingEditor.vue` | Section state, ASR routing, summarization, autosave and canonical payload creation |
| `tests/ui/MeetingEditor.spec.js` | Editor data-flow integration tests |
| `src/composables/useSummarizer.js` | Summarizer HTTP client only; obsolete content-merging helper is removed |
| `tests/summarizer-client.test.js` | Summarizer transport behavior after merge helper removal |
| `src/components/MeetingDetail.vue` | Parse saved content and default the read workspace to minutes |
| `tests/ui/MeetingDetail.spec.js` | Read-mode default and transcript switching |
| `tests/e2e/ui-redesign.spec.js` | Desktop/mobile summary-first browser workflow and visual evidence |
| `E:\Objects\MeetingRecord\PROJECT_PROGRESS.md` | Long-term status, verification evidence and continuation point |

### Task 1: Add the meeting-content codec

**Files:**
- Create: `src/domain/meetingContent.js`
- Create: `tests/meeting-content.test.js`

- [ ] **Step 1: Write failing codec tests**

Create `tests/meeting-content.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  normalizeMeetingSummary,
  parseMeetingContent,
  serializeMeetingContent
} from '../src/domain/meetingContent.js'

test('canonical meeting content round-trips without loss', () => {
  const content = serializeMeetingContent({
    summary: '### 会议决定\n\n继续推进 8B 模型。',
    transcript: '[00:00-00:30]\n讨论模型选择。'
  })

  assert.equal(content, [
    '## 会议纪要',
    '',
    '### 会议决定',
    '',
    '继续推进 8B 模型。',
    '',
    '---',
    '',
    '## 完整转写',
    '',
    '[00:00-00:30]',
    '讨论模型选择。'
  ].join('\n'))
  assert.deepEqual(parseMeetingContent(content), {
    summary: '### 会议决定\n\n继续推进 8B 模型。',
    transcript: '[00:00-00:30]\n讨论模型选择。'
  })
})

test('legacy transcript followed by minutes draft is split conservatively', () => {
  assert.deepEqual(parseMeetingContent([
    '## 语音转写原文',
    '',
    '[00:00-00:30] 讨论预算。',
    '',
    '## 会议纪要草稿',
    '',
    '### 会议决定',
    '- 批准预算'
  ].join('\n')), {
    summary: '### 会议决定\n- 批准预算',
    transcript: '## 语音转写原文\n\n[00:00-00:30] 讨论预算。'
  })
})

test('legacy minutes draft without transcript is normalized as minutes', () => {
  assert.deepEqual(parseMeetingContent('## 会议纪要草稿\n\n### 结论\n继续推进'), {
    summary: '### 结论\n继续推进',
    transcript: ''
  })
})

test('unmarked legacy content remains primary meeting minutes', () => {
  assert.deepEqual(parseMeetingContent('## 手写纪要\n\n保留原始内容。'), {
    summary: '## 手写纪要\n\n保留原始内容。',
    transcript: ''
  })
})

test('transcript-only canonical content survives reload', () => {
  const content = serializeMeetingContent({ summary: '', transcript: '完整转写内容' })
  assert.equal(content, '## 完整转写\n\n完整转写内容')
  assert.deepEqual(parseMeetingContent(content), { summary: '', transcript: '完整转写内容' })
})

test('normalizes one leading minutes wrapper heading', () => {
  assert.equal(
    normalizeMeetingSummary('## 会议纪要草稿\n\n### 结论\n继续推进'),
    '### 结论\n继续推进'
  )
  assert.equal(
    normalizeMeetingSummary('## 会议纪要\n\n### 结论\n继续推进'),
    '### 结论\n继续推进'
  )
})
```

- [ ] **Step 2: Run the codec tests and verify RED**

Run:

```powershell
node --test tests/meeting-content.test.js
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/domain/meetingContent.js`.

- [ ] **Step 3: Implement the pure codec**

Create `src/domain/meetingContent.js`:

```js
const SUMMARY_HEADING = '## 会议纪要'
const TRANSCRIPT_HEADING = '## 完整转写'
const LEGACY_SUMMARY_HEADING = '## 会议纪要草稿'

function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim()
}

function sectionAfterHeading(source, heading) {
  return source.slice(heading.length).trim()
}

export function normalizeMeetingSummary(summary) {
  const normalized = normalizeLineEndings(summary)
  if (normalized.startsWith(LEGACY_SUMMARY_HEADING)) {
    return sectionAfterHeading(normalized, LEGACY_SUMMARY_HEADING)
  }
  if (normalized.startsWith(SUMMARY_HEADING)) {
    return sectionAfterHeading(normalized, SUMMARY_HEADING)
  }
  return normalized
}

export function parseMeetingContent(content) {
  const source = normalizeLineEndings(content)
  if (!source) return { summary: '', transcript: '' }

  if (source.startsWith(SUMMARY_HEADING)) {
    const transcriptMarker = `\n${TRANSCRIPT_HEADING}`
    const transcriptIndex = source.indexOf(transcriptMarker)
    if (transcriptIndex >= 0) {
      const summaryBlock = source
        .slice(SUMMARY_HEADING.length, transcriptIndex)
        .trim()
        .replace(/\n---\s*$/, '')
        .trim()
      return {
        summary: normalizeMeetingSummary(summaryBlock),
        transcript: sectionAfterHeading(source.slice(transcriptIndex + 1), TRANSCRIPT_HEADING)
      }
    }
    return { summary: sectionAfterHeading(source, SUMMARY_HEADING), transcript: '' }
  }

  if (source.startsWith(TRANSCRIPT_HEADING)) {
    return { summary: '', transcript: sectionAfterHeading(source, TRANSCRIPT_HEADING) }
  }

  if (source.startsWith(LEGACY_SUMMARY_HEADING)) {
    return { summary: normalizeMeetingSummary(source), transcript: '' }
  }

  const legacyMarker = `\n${LEGACY_SUMMARY_HEADING}`
  const legacyIndex = source.indexOf(legacyMarker)
  if (legacyIndex >= 0) {
    return {
      summary: normalizeMeetingSummary(source.slice(legacyIndex + 1)),
      transcript: source.slice(0, legacyIndex).trim()
    }
  }

  return { summary: source, transcript: '' }
}

export function serializeMeetingContent({ summary, transcript }) {
  const normalizedSummary = normalizeMeetingSummary(summary)
  const normalizedTranscript = normalizeLineEndings(transcript)
  const sections = []

  if (normalizedSummary) {
    sections.push(`${SUMMARY_HEADING}\n\n${normalizedSummary}`)
  }
  if (normalizedTranscript) {
    sections.push(`${TRANSCRIPT_HEADING}\n\n${normalizedTranscript}`)
  }

  return sections.join('\n\n---\n\n')
}
```

- [ ] **Step 4: Run focused and full Node tests**

Run:

```powershell
node --test tests/meeting-content.test.js
npm.cmd run test:server
```

Expected: codec tests 6/6 PASS and the existing 50 Node tests remain green.

- [ ] **Step 5: Commit the codec**

```powershell
git add -- src/domain/meetingContent.js tests/meeting-content.test.js
git commit -m "feat: add meeting content section codec"
```

### Task 2: Build the accessible section switcher

**Files:**
- Create: `src/components/MeetingContentTabs.vue`
- Create: `tests/ui/MeetingContentTabs.spec.js`

- [ ] **Step 1: Write the failing component tests**

Create `tests/ui/MeetingContentTabs.spec.js`:

```js
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeetingContentTabs from '@/components/MeetingContentTabs.vue'

describe('MeetingContentTabs', () => {
  it('exposes minutes as the selected default section', () => {
    const wrapper = mount(MeetingContentTabs, {
      props: { modelValue: 'summary' }
    })

    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('会议内容')
    expect(wrapper.get('[data-section="summary"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-section="transcript"]').attributes('aria-selected')).toBe('false')
  })

  it('emits the selected section', async () => {
    const wrapper = mount(MeetingContentTabs, {
      props: { modelValue: 'summary' }
    })

    await wrapper.get('[data-section="transcript"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['transcript'])
  })
})
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```powershell
npx.cmd vitest run tests/ui/MeetingContentTabs.spec.js
```

Expected: FAIL because `MeetingContentTabs.vue` does not exist.

- [ ] **Step 3: Implement the segmented control**

Create `src/components/MeetingContentTabs.vue`:

```vue
<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'summary',
    validator: value => ['summary', 'transcript'].includes(value)
  }
})

defineEmits(['update:modelValue'])

const sections = [
  { key: 'summary', label: '会议纪要' },
  { key: 'transcript', label: '完整转写' }
]
</script>

<template>
  <div
    role="tablist"
    aria-label="会议内容"
    class="grid w-full grid-cols-2 rounded-panel bg-black/[0.055] p-[3px] sm:w-[260px]"
  >
    <button
      v-for="section in sections"
      :key="section.key"
      type="button"
      role="tab"
      :data-section="section.key"
      :aria-selected="modelValue === section.key"
      class="focus-ring min-h-10 rounded-control px-3 text-xs font-medium transition-colors sm:min-h-8"
      :class="modelValue === section.key ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'"
      @click="$emit('update:modelValue', section.key)"
    >
      {{ section.label }}
    </button>
  </div>
</template>
```

- [ ] **Step 4: Verify the component**

Run:

```powershell
npx.cmd vitest run tests/ui/MeetingContentTabs.spec.js
```

Expected: 2/2 PASS.

- [ ] **Step 5: Commit the switcher**

```powershell
git add -- src/components/MeetingContentTabs.vue tests/ui/MeetingContentTabs.spec.js
git commit -m "feat: add meeting content section switcher"
```

### Task 3: Make MeetingDocument render controlled sections

**Files:**
- Modify: `src/components/MeetingDocument.vue`
- Modify: `tests/ui/MeetingDocument.spec.js`

- [ ] **Step 1: Add failing controlled-section tests**

Add these tests inside `describe('MeetingDocument')` in `tests/ui/MeetingDocument.spec.js`:

```js
  it('defaults to minutes and switches to the complete transcript', async () => {
    const structuredMeeting = {
      ...meeting,
      summary: '### 会议决定\n继续推进',
      transcript: '[00:00-00:30] 讨论方案'
    }
    const wrapper = mount(MeetingDocument, {
      props: {
        modelValue: structuredMeeting,
        mode: 'edit',
        activeSection: 'summary'
      }
    })

    expect(wrapper.get('[data-field="summary"]').element.value).toContain('继续推进')
    await wrapper.get('[data-section="transcript"]').trigger('click')
    expect(wrapper.emitted('update:activeSection')[0]).toEqual(['transcript'])
  })

  it('emits only the active section content', async () => {
    const structuredMeeting = { ...meeting, summary: '', transcript: '原始转写' }
    const wrapper = mount(MeetingDocument, {
      props: {
        modelValue: structuredMeeting,
        mode: 'edit',
        activeSection: 'transcript'
      }
    })

    await wrapper.get('[data-field="transcript"]').setValue('修正后的转写')
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual({
      ...structuredMeeting,
      transcript: '修正后的转写'
    })
  })

  it('shows minutes first in read mode and keeps transcript available', () => {
    const wrapper = mount(MeetingDocument, {
      props: {
        modelValue: { ...meeting, summary: '整理结论', transcript: '详细原文' },
        mode: 'read',
        activeSection: 'summary'
      }
    })

    expect(wrapper.get('[data-content="summary"]').text()).toContain('整理结论')
    expect(wrapper.find('[data-content="transcript"]').exists()).toBe(false)
  })

  it('disables organization until a transcript exists', () => {
    const wrapper = mount(MeetingDocument, {
      props: {
        modelValue: { ...meeting, summary: '', transcript: '' },
        mode: 'edit',
        activeSection: 'summary'
      }
    })

    expect(wrapper.get('[data-action="organize-empty"]').attributes('disabled')).toBeDefined()
  })
```

- [ ] **Step 2: Run the document tests and verify RED**

Run:

```powershell
npx.cmd vitest run tests/ui/MeetingDocument.spec.js
```

Expected: FAIL because the component has no `activeSection`, tab control or section-specific fields.

- [ ] **Step 3: Add controlled-section state and events**

In `MeetingDocument.vue`:

1. Import `computed` and `MeetingContentTabs`. Add `const sectionTopRef = ref(null)` beside `contentRef`.
2. Add the `activeSection` prop with default `summary`.
3. Add `update:activeSection` and `organize` to `defineEmits`.
4. Define the active field and value:

```js
const activeField = computed(() => props.activeSection === 'transcript' ? 'transcript' : 'summary')
const activeContent = computed(() => {
  const structuredValue = props.modelValue[activeField.value]
  if (structuredValue !== undefined) return structuredValue
  return activeField.value === 'summary' ? props.modelValue.content || '' : ''
})

function patchActiveContent(value) {
  const usesStructuredSections = 'summary' in props.modelValue || 'transcript' in props.modelValue
  if (usesStructuredSections) patch({ [activeField.value]: value })
  else patch({ content: value })
}

function scrollToSectionTop() {
  sectionTopRef.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}
```

Add `scrollToSectionTop` to the existing `defineExpose` call:

```js
defineExpose({ focusContent, getContentElement, scrollToSectionTop })
```

Replace the single undifferentiated content area with:

```vue
      <div ref="sectionTopRef" data-section-top class="mt-5 flex items-center justify-between gap-3 border-b border-line pb-4">
        <MeetingContentTabs
          :model-value="activeSection"
          @update:model-value="$emit('update:activeSection', $event)"
        />
      </div>

      <div class="sticky top-0 z-10 -mx-2 border-b border-line bg-white/90 px-2 py-2 backdrop-blur-xl">
        <slot name="toolbar"></slot>
      </div>

      <div
        v-if="activeSection === 'summary' && !activeContent"
        class="mt-5 rounded-panel border border-line bg-canvas px-4 py-3 text-xs text-secondary"
      >
        <p>尚未生成会议纪要</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="command-button"
            data-action="organize-empty"
            :disabled="!modelValue.transcript?.trim()"
            @click="$emit('organize')"
          >
            整理会议纪要
          </button>
          <button type="button" class="btn-ghost" data-action="show-transcript" @click="$emit('update:activeSection', 'transcript')">
            查看完整转写
          </button>
        </div>
      </div>

      <textarea
        ref="contentRef"
        :value="activeContent"
        :data-field="activeField"
        :aria-label="activeSection === 'summary' ? '会议纪要' : '完整转写'"
        class="focus-ring mt-5 min-h-[430px] w-full resize-none rounded-control border-0 bg-transparent p-0 text-sm leading-7 text-secondary placeholder:text-black/25"
        :placeholder="activeSection === 'summary' ? '记录会议结论、决定和行动项' : '语音转写将在这里显示，也可手动修正识别结果'"
        @input="patchActiveContent($event.target.value)"
        @keydown="$emit('content-keydown', $event)"
      ></textarea>
```

In read mode, place `MeetingContentTabs` after metadata and render only the selected section:

```vue
      <div ref="sectionTopRef" data-section-top class="mt-5 border-b border-line pb-4">
        <MeetingContentTabs
          :model-value="activeSection"
          @update:model-value="$emit('update:activeSection', $event)"
        />
      </div>
      <pre
        v-if="activeContent"
        :data-content="activeField"
        class="mt-6 whitespace-pre-wrap font-sans text-sm leading-7 text-secondary"
      >{{ activeContent }}</pre>
      <div v-else :data-content="activeField" class="mt-8 text-sm text-muted">
        <p>{{ activeSection === 'summary' ? '该会议尚未整理纪要' : '暂无完整转写' }}</p>
        <button
          v-if="activeSection === 'summary' && modelValue.transcript"
          type="button"
          class="command-button mt-3"
          data-action="show-transcript"
          @click="$emit('update:activeSection', 'transcript')"
        >
          查看完整转写
        </button>
      </div>
```

- [ ] **Step 4: Update existing MeetingDocument assertions**

In existing edit tests, replace `[data-field="content"]` with `[data-field="summary"]`. In the existing read test, pass `activeSection: 'summary'` and replace `[data-content="read"]` with `[data-content="summary"]`.

- [ ] **Step 5: Run focused and full UI tests**

Run:

```powershell
npx.cmd vitest run tests/ui/MeetingContentTabs.spec.js tests/ui/MeetingDocument.spec.js
npm.cmd run test:ui
```

Expected: focused tests PASS and the UI suite remains green.

- [ ] **Step 6: Commit the document surface**

```powershell
git add -- src/components/MeetingDocument.vue tests/ui/MeetingDocument.spec.js
git commit -m "feat: split meeting document into minutes and transcript views"
```

### Task 4: Route editor and detail data through the two sections

**Files:**
- Modify: `src/components/MeetingEditor.vue`
- Modify: `src/components/MeetingDetail.vue`
- Modify: `src/composables/useSummarizer.js`
- Modify: `tests/ui/MeetingEditor.spec.js`
- Modify: `tests/ui/MeetingDetail.spec.js`
- Modify: `tests/summarizer-client.test.js`

- [ ] **Step 1: Replace the editor integration test with section-specific expectations**

In `tests/ui/MeetingEditor.spec.js`:

1. Remove the mocked `mergeSummaryIntoContent` export.
2. Change `initialData.content` to canonical content:

```js
  content: [
    '## 会议纪要',
    '',
    '原始纪要',
    '',
    '---',
    '',
    '## 完整转写',
    '',
    '原始转写内容'
  ].join('\n')
```

3. Replace the combined behavior test with:

```js
  it('keeps transcript and minutes separate across ASR and summarization', async () => {
    const wrapper = mount(MeetingEditor, { props: { initialData } })
    await nextTick()

    expect(wrapper.get('[data-section="summary"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-field="summary"]').element.value).toContain('原始纪要')

    await wrapper.get('[data-section="transcript"]').trigger('click')

    const fileInput = wrapper.get('input[type="file"]')
    const audio = new File(['audio'], 'meeting.wav', { type: 'audio/wav' })
    Object.defineProperty(fileInput.element, 'files', { configurable: true, value: [audio] })
    await fileInput.trigger('change')
    await flushPromises()

    expect(clients.transcribeAudio).toHaveBeenCalledWith(audio)
    expect(wrapper.get('[data-field="transcript"]').element.value).toContain('转写结果')

    await wrapper.get('[data-action="summarize"]').trigger('click')
    await flushPromises()

    expect(clients.summarizeContent).toHaveBeenCalledWith(expect.stringContaining('原始转写内容'))
    expect(clients.summarizeContent.mock.calls[0][0]).not.toContain('原始纪要')
    expect(wrapper.get('[data-section="summary"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-field="summary"]').element.value).toContain('确认三项行动')

    await wrapper.get('[data-section="transcript"]').trigger('click')
    expect(wrapper.get('[data-field="transcript"]').element.value).toContain('转写结果')
    wrapper.unmount()
  })
```

4. In the save test, assert that emitted payload has canonical `content` and no internal fields:

```js
    const saved = wrapper.emitted('save')[0][0]
    expect(saved.content).toContain('## 会议纪要')
    expect(saved.content).toContain('## 完整转写')
    expect(saved).not.toHaveProperty('summary')
    expect(saved).not.toHaveProperty('transcript')
```

- [ ] **Step 2: Add failing read-detail section tests**

Change the meeting fixture in `tests/ui/MeetingDetail.spec.js` to canonical content and update the first test:

```js
  content: [
    '## 会议纪要',
    '',
    '### 会议决定',
    '统一使用 Qwen3 8B。',
    '',
    '---',
    '',
    '## 完整转写',
    '',
    '[00:00-00:30] 讨论模型选择。'
  ].join('\n'),
```

```js
  it('shows minutes first and reveals transcript on demand', async () => {
    const wrapper = mount(MeetingDetail, { props: { meeting } })

    expect(wrapper.get('[data-content="summary"]').text()).toContain('统一使用 Qwen3 8B')
    expect(wrapper.find('[data-content="transcript"]').exists()).toBe(false)

    await wrapper.get('[data-section="transcript"]').trigger('click')
    expect(wrapper.get('[data-content="transcript"]').text()).toContain('讨论模型选择')
  })
```

- [ ] **Step 3: Run editor and detail tests and verify RED**

Run:

```powershell
npx.cmd vitest run tests/ui/MeetingEditor.spec.js tests/ui/MeetingDetail.spec.js
```

Expected: FAIL because containers do not parse, serialize or control the active section.

- [ ] **Step 4: Refactor MeetingEditor section state**

In `MeetingEditor.vue`:

1. Import the codec:

```js
import {
  normalizeMeetingSummary,
  parseMeetingContent,
  serializeMeetingContent
} from '@/domain/meetingContent.js'
```

2. Remove `mergeSummaryIntoContent` from the summarizer import.
3. Replace `content: ''` in `form` with:

```js
  summary: '',
  transcript: ''
```

4. Add controlled selection:

```js
const activeSection = ref('summary')
```

5. In `initForm`, parse persisted content:

```js
    const sections = parseMeetingContent(props.initialData.content)
    form.summary = sections.summary
    form.transcript = sections.transcript
```

6. Add one canonical payload builder and use it for autosave, submit and export:

```js
function buildMeetingPayload() {
  const { summary, transcript, ...metadata } = form
  return {
    ...metadata,
    attendees: [...form.attendees],
    content: serializeMeetingContent({ summary, transcript })
  }
}
```

7. Make all Markdown cursor helpers operate on one computed active section:

```js
const activeContent = computed({
  get: () => form[activeSection.value],
  set: value => {
    form[activeSection.value] = value
  }
})
```

Within the cursor-editing block (`insertAtCursor`, `replaceAtCursor`, `handleEnterKey`, `onKeydown` and their list helpers), mechanically replace every `form.content` read or write with `activeContent.value`. Do not replace transcript routing, summarization or payload serialization references. For example, the first two helpers become:

```js
function insertAtCursor(before, after = '') {
  const el = getContentElement()
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = activeContent.value.substring(start, end)
  const replacement = before + selected + after
  activeContent.value = activeContent.value.substring(0, start) + replacement + activeContent.value.substring(end)
  nextTick(() => {
    el.focus()
    const pos = start + before.length + selected.length + after.length
    el.setSelectionRange(pos, pos)
  })
}

function replaceAtCursor(text) {
  const el = getContentElement()
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  activeContent.value = activeContent.value.substring(0, start) + text + activeContent.value.substring(end)
  nextTick(() => {
    el.focus()
    const pos = start + text.length
    el.setSelectionRange(pos, pos)
  })
}
```

8. Route audio upload to transcript and select it:

```js
    const prefix = form.transcript.trim() ? '\n\n' : ''
    form.transcript = `${form.transcript.trimEnd()}${prefix}${transcript}`
    activeSection.value = 'transcript'
```

9. Replace `appendRecordingResult` with:

```js
function appendRecordingResult(result) {
  const transcript = formatTranscriptForEditor(result.asr)
  if (transcript) {
    form.transcript = form.transcript.trim()
      ? `${form.transcript.trimEnd()}\n\n${transcript}`
      : transcript
  }
  if (result.summary) {
    form.summary = normalizeMeetingSummary(result.summary)
    activeSection.value = 'summary'
  } else if (transcript) {
    activeSection.value = 'transcript'
  }
  nextTick(() => documentRef.value?.focusContent?.())
}
```

10. Replace `handleSummarize` content checks and success assignment:

```js
  if (!form.transcript.trim()) {
    summaryStatus.value = '没有可整理的完整转写'
    setTimeout(() => {
      if (summaryStatus.value === '没有可整理的完整转写') summaryStatus.value = ''
    }, 3000)
    return
  }

  isSummarizing.value = true
  summaryStatus.value = '纪要整理中...'
  try {
    const result = await summarizer.summarizeContent(form.transcript)
    form.summary = normalizeMeetingSummary(result.summary)
    activeSection.value = 'summary'
    summaryStatus.value = '纪要已生成'
    nextTick(() => documentRef.value?.scrollToSectionTop?.())
    setTimeout(() => {
      if (summaryStatus.value === '纪要已生成') summaryStatus.value = ''
    }, 3000)
  } catch (error) {
    console.error('LLM 纪要整理失败:', error)
    summaryStatus.value = error?.message || 'LLM 服务不可用'
  } finally {
    isSummarizing.value = false
  }
```

11. Bind the document and assistant with section-specific state:

```vue
      <MeetingDocument
        ref="documentRef"
        :model-value="form"
        mode="edit"
        :active-section="activeSection"
        @update:model-value="applyFormUpdate"
        @update:active-section="activeSection = $event"
        @organize="handleSummarize"
        @add-attendee="addAttendee"
        @remove-attendee="removeAttendee"
        @content-keydown="onKeydown"
      >
```

Set `MeetingAssistant`'s `has-content` prop to `Boolean(form.transcript.trim())` because organization requires source transcript.

12. Replace the persistence boundary in `doAutoSave`, `handleSubmit` and `handleExport` with the canonical payload:

```js
async function doAutoSave() {
  if (!form.title.trim() && !form.summary.trim() && !form.transcript.trim()) return

  const prevLabel = autoSaveLabel.value
  autoSaveLabel.value = '保存中…'
  try {
    const payload = buildMeetingPayload()
    if (form.id) {
      await api.updateMeeting(form.id, payload)
    } else {
      const result = await api.createMeeting(payload)
      form.id = result.id
    }
    const ts = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    autoSaveLabel.value = `已自动保存 ${ts}`
    setTimeout(() => {
      if (autoSaveLabel.value === `已自动保存 ${ts}`) autoSaveLabel.value = ''
    }, 3000)
  } catch (error) {
    console.error('自动保存失败:', error)
    autoSaveLabel.value = '自动保存失败'
    setTimeout(() => {
      if (autoSaveLabel.value === '自动保存失败') autoSaveLabel.value = prevLabel
    }, 3000)
  }
}

function handleSubmit() {
  if (!form.title.trim()) {
    alert('请输入会议标题')
    return
  }
  emit('save', buildMeetingPayload())
}

function handleExport(format = 'docx') {
  if (!form.id) return
  emit('export', buildMeetingPayload(), format)
}
```

- [ ] **Step 5: Refactor MeetingDetail controlled read state**

In `MeetingDetail.vue`:

```js
import { computed, ref } from 'vue'
import { parseMeetingContent } from '@/domain/meetingContent.js'

const assistantOpen = ref(false)
const activeSection = ref('summary')
const documentMeeting = computed(() => ({
  ...props.meeting,
  ...parseMeetingContent(props.meeting.content)
}))
```

Bind the document:

```vue
      <MeetingDocument
        :model-value="documentMeeting"
        mode="read"
        :active-section="activeSection"
        @update:active-section="activeSection = $event"
      />
```

Keep export and edit events based on the original `meeting` prop so no internal section fields cross the public boundary.

- [ ] **Step 6: Remove the obsolete merge helper**

Delete `mergeSummaryIntoContent` from `src/composables/useSummarizer.js`. In `tests/summarizer-client.test.js`, remove its import and delete the two `mergeSummaryIntoContent` tests; transport and authentication tests remain unchanged.

- [ ] **Step 7: Verify editor, detail and transport tests**

Run:

```powershell
npx.cmd vitest run tests/ui/MeetingEditor.spec.js tests/ui/MeetingDetail.spec.js
node --test tests/meeting-content.test.js tests/summarizer-client.test.js
npm.cmd test
```

Expected: focused tests PASS; full suite reports zero failures.

- [ ] **Step 8: Commit section data flow**

```powershell
git add -- src/components/MeetingEditor.vue src/components/MeetingDetail.vue src/composables/useSummarizer.js tests/ui/MeetingEditor.spec.js tests/ui/MeetingDetail.spec.js tests/summarizer-client.test.js
git commit -m "feat: make meeting minutes the primary document view"
```

### Task 5: Verify the summary-first workflow in Chrome

**Files:**
- Modify: `tests/e2e/ui-redesign.spec.js`

- [ ] **Step 1: Add a canonical seed and summarizer mock**

Change `seedMeeting.content` to:

```js
  content: [
    '## 会议纪要',
    '',
    '### 会议决定',
    '确认第三季度优先事项。',
    '',
    '---',
    '',
    '## 完整转写',
    '',
    '[00:00-00:30] 讨论第三季度优先事项。',
    '[00:30-01:00] 确认负责人和截止日期。'
  ].join('\n'),
```

Add this route before the generic 404 response in `mockApi`:

```js
    if (pathname === '/api/summarize' && request.method() === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summary: '## 会议纪要草稿\n\n### 关键结论\n\n确认第三季度发布计划。'
        })
      })
    }
```

- [ ] **Step 2: Add failing browser assertions**

In the desktop workflow, after opening `季度目标讨论`, assert minutes are selected and the transcript is hidden, then switch:

```js
  await expect(page.getByRole('tab', { name: '会议纪要' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('确认第三季度优先事项。')).toBeVisible()
  await expect(page.getByText('讨论第三季度优先事项。')).toHaveCount(0)
  await page.getByRole('tab', { name: '完整转写' }).click()
  await expect(page.getByText(/讨论第三季度优先事项/)).toBeVisible()
  await page.getByRole('tab', { name: '会议纪要' }).click()
```

Before completing the newly created meeting, exercise actual organization through the mocked API:

```js
  await page.getByRole('tab', { name: '完整转写' }).click()
  await page.getByLabel('完整转写').fill('[00:00-00:30] 讨论第三季度发布计划。')
  await page.getByRole('button', { name: '整理会议纪要' }).click()
  await expect(page.getByRole('tab', { name: '会议纪要' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByLabel('会议纪要')).toHaveValue(/确认第三季度发布计划/)
  await expect(page.locator('[data-section-top]')).toBeInViewport()
```

In the mobile editor workflow, assert both tabs fit and switch without overflow:

```js
  await expect(page.getByRole('tab', { name: '会议纪要' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '完整转写' })).toBeVisible()
  await page.getByRole('tab', { name: '完整转写' }).click()
```

- [ ] **Step 3: Run E2E and verify RED**

Run:

```powershell
$env:UI_QA_DIR='C:\Users\Administrator\.codex\qa\meetingrecord-summary-tabs'
npm.cmd run test:e2e
```

Expected: FAIL because the current document has no tabs.

- [ ] **Step 4: Update existing selectors and screenshot evidence**

- Replace editor selector `getByLabel('会议正文')` with `getByLabel('会议纪要')` where the test inserts the meeting template.
- Save the desktop read screenshot after returning to `会议纪要` as `desktop-summary-first-1440x900.png`.
- Save the transcript view as `desktop-transcript-1440x900.png`.
- Save the mobile tab view as `mobile-summary-tabs-390x844.png`.
- Keep the existing console-error capture and horizontal-overflow assertions.

- [ ] **Step 5: Run Chrome E2E and inspect screenshots**

Run:

```powershell
$env:UI_QA_DIR='C:\Users\Administrator\.codex\qa\meetingrecord-summary-tabs'
npm.cmd run test:e2e
```

Expected: 2/2 PASS with no captured application console errors.

Inspect all three screenshots with `view_image`. Verify:

- minutes are visible without document scrolling;
- the two-option control matches existing Apple-like tokens;
- transcript switching does not move metadata or the assistant rail;
- 390px layout has no clipping or overflow.

- [ ] **Step 6: Commit browser coverage**

```powershell
git add -- tests/e2e/ui-redesign.spec.js
git commit -m "test: cover summary-first meeting workflow"
```

### Task 6: Final verification and progress handoff

**Files:**
- Modify: `E:\Objects\MeetingRecord\PROJECT_PROGRESS.md`

- [ ] **Step 1: Run fresh full verification**

Run from `meeting-assistant`:

```powershell
git diff --check
npm.cmd test
npm.cmd run build
$env:UI_QA_DIR='C:\Users\Administrator\.codex\qa\meetingrecord-summary-tabs'
npm.cmd run test:e2e
npm.cmd audit --omit=dev
git status --short
```

Expected:

- `git diff --check`: exit 0;
- Node and UI suites: zero failures;
- Vite build: exit 0;
- Playwright: 2/2 PASS;
- production dependency audit: 0 vulnerabilities;
- only known pre-existing ASR/model-gateway/App changes remain unstaged.

- [ ] **Step 2: Review requirements line by line**

Confirm all of the following from tests and screenshots:

- meeting detail opens on `会议纪要`;
- long transcript is hidden until requested;
- ASR writes only to transcript;
- summarization sends only transcript and replaces only minutes;
- canonical and legacy records survive save/reload;
- desktop and mobile remain visually stable;
- no deployment occurred.

- [ ] **Step 3: Update the long-term progress file**

In `E:\Objects\MeetingRecord\PROJECT_PROGRESS.md`:

- update `最后更新`;
- record the new commit hashes and fresh test counts;
- record screenshot directory `C:\Users\Administrator\.codex\qa\meetingrecord-summary-tabs`;
- state explicitly that cloud deployment was not performed;
- set `下次从这里开始` to either remaining dirty-worktree consolidation or an explicitly requested deployment.

- [ ] **Step 4: Commit only the progress file in the root worktree**

Run from `E:\Objects\MeetingRecord`:

```powershell
git add -- PROJECT_PROGRESS.md
git diff --cached --check
git commit -m "docs: record summary-first workflow progress"
```

- [ ] **Step 5: Present branch completion options**

Use `superpowers:finishing-a-development-branch`. Do not merge, push, open a PR, delete a branch or deploy until the user selects the corresponding action.
