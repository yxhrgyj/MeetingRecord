# Meeting Assistant UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved Time Horizon UI across the calendar, meeting editor, and meeting detail surfaces without changing the meeting, recording, ASR, summarization, storage, or deployment contracts.

**Architecture:** Keep `App.vue` as the screen-state coordinator and keep the existing API/ASR/recording/summarizer composables as behavior boundaries. Extract the oversized editor presentation into a shared `MeetingWorkspace`, a document surface, an assistant rail, and focused header/status panels; drive those components through props and events so the existing behavior remains testable and unchanged.

**Tech Stack:** Vue 3, Vite 5, Tailwind CSS 3, lucide-vue-next, Vitest, Vue Test Utils, jsdom, Playwright, Node Test Runner

---

## Preconditions

- Execute in `E:\Objects\MeetingRecord\.worktrees\asr-service\meeting-assistant` on `feature/asr-service`.
- Preserve all existing uncommitted ASR, model gateway, settings, and test changes. Stage only the files listed in the current task.
- Treat `docs/superpowers/specs/2026-07-13-meeting-assistant-ui-redesign-design.md` and the three `.superpowers/brainstorm/ui-redesign-20260713/content/*.html` screens as the visual source of truth.
- Do not deploy Cloudflare Pages during this plan.

## File Map

### Create

- `vitest.config.js`: Vue/jsdom component-test configuration.
- `tests/ui/setup.js`: browser API stubs and test cleanup.
- `tests/ui/MeetingProcessStatus.spec.js`: process state rendering.
- `tests/ui/CalendarToolbar.spec.js`: toolbar events and overflow actions.
- `tests/ui/CalendarViews.spec.js`: month/week/day rendering and selection behavior.
- `tests/ui/MeetingWorkspace.spec.js`: desktop rail and mobile drawer behavior.
- `tests/ui/MeetingDocument.spec.js`: editable/read-only document behavior.
- `tests/ui/MeetingAssistant.spec.js`: recording, ASR, summary, and disabled states.
- `tests/ui/MeetingEditor.spec.js`: editor integration and preserved actions.
- `tests/ui/MeetingDetail.spec.js`: detail integration and management events.
- `tests/ui/ModelSettingsDialog.spec.js`: settings dialog behavior.
- `tests/ui/AppResponsive.spec.js`: mobile initial view and app-level responsive wiring.
- `tests/e2e/ui-redesign.spec.js`: browser workflow and screenshot coverage.
- `playwright.config.js`: local browser-test server and viewport defaults.
- `src/components/CalendarToolbar.vue`: calendar command surface.
- `src/components/MeetingWorkspace.vue`: shared edit/read responsive shell.
- `src/components/MeetingWorkspaceHeader.vue`: back, save, export, complete/edit actions.
- `src/components/MeetingProcessStatus.vue`: Record -> Transcribe -> Organize status line.
- `src/components/MeetingDocument.vue`: title, metadata, attendees, and content surface.
- `src/components/MeetingEditorToolbar.vue`: Markdown insertion commands.
- `src/components/MeetingAssistant.vue`: recording, upload, summary, and export controls.
- `src/components/MeetingInfoPanel.vue`: read-only metadata, export, and delete controls.
- `src/components/ModelSettingsDialog.vue`: extracted model gateway dialog.

### Modify

- `package.json`, `package-lock.json`: declare Vue, Lucide, component-test, and browser-test dependencies.
- `tailwind.config.js`: approved palette, font stack, radius, and shadow tokens.
- `src/style.css`: global tokens, controls, focus, reduced motion, and scrollbar treatment.
- `src/App.vue`: use the new toolbar/dialog and responsive initial view.
- `src/components/CalendarView.vue`: loading and shared surface styling.
- `src/components/MonthView.vue`: Time Horizon month grid.
- `src/components/WeekView.vue`: matching week timeline.
- `src/components/DayView.vue`: matching day timeline.
- `src/components/MeetingEditor.vue`: retain behavior and compose extracted presentation components.
- `src/components/MeetingDetail.vue`: compose the shared read-only workspace.
- `E:\Objects\MeetingRecord\PROJECT_PROGRESS.md`: record implementation and verification status after each completed checkpoint.

## Task 1: Establish UI Test Infrastructure and Design Tokens

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tailwind.config.js`
- Modify: `src/style.css`
- Create: `vitest.config.js`
- Create: `tests/ui/setup.js`
- Create: `tests/ui/MeetingProcessStatus.spec.js`
- Create: `src/components/MeetingProcessStatus.vue`

- [ ] **Step 1: Declare the runtime and test dependencies**

Run:

```powershell
npm.cmd install vue@^3.5.0 lucide-vue-next@^0.468.0
npm.cmd install --save-dev vitest@^3.0.0 @vue/test-utils@^2.4.6 jsdom@^26.0.0 @playwright/test@^1.49.0
```

Expected: `package.json` explicitly contains `vue` and `lucide-vue-next`; the four test packages appear in `devDependencies`; `package-lock.json` updates without removing existing dependencies.

- [ ] **Step 2: Add the component-test command and jsdom setup**

Add these scripts to `package.json`:

```json
"test": "node --test && vitest run",
"test:server": "node --test",
"test:ui": "vitest run tests/ui",
"test:e2e": "playwright test"
```

Create `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/ui/setup.js'],
    include: ['tests/ui/**/*.spec.js'],
    restoreMocks: true
  }
})
```

Create `tests/ui/setup.js`:

```js
import { afterEach, vi } from 'vitest'
import { config } from '@vue/test-utils'

config.global.stubs.transition = false
config.global.stubs['transition-group'] = false

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

afterEach(() => document.body.replaceChildren())
```

- [ ] **Step 3: Write the failing process-state test**

Create `tests/ui/MeetingProcessStatus.spec.js`:

```js
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeetingProcessStatus from '@/components/MeetingProcessStatus.vue'

describe('MeetingProcessStatus', () => {
  it('marks the active phase and exposes text status', () => {
    const wrapper = mount(MeetingProcessStatus, {
      props: { phase: 'transcribe', status: '正在转写第 3 个片段' }
    })
    expect(wrapper.get('[data-phase="record"]').attributes('aria-current')).toBeUndefined()
    expect(wrapper.get('[data-phase="transcribe"]').attributes('aria-current')).toBe('step')
    expect(wrapper.text()).toContain('正在转写第 3 个片段')
  })

  it('renders an actionable error without relying on color', async () => {
    const wrapper = mount(MeetingProcessStatus, {
      props: { phase: 'organize', status: '模型服务暂不可用', tone: 'warning', retryable: true }
    })
    await wrapper.get('[data-action="retry"]').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
```

- [ ] **Step 4: Run the test and verify the expected failure**

Run: `npm.cmd run test:ui -- tests/ui/MeetingProcessStatus.spec.js`

Expected: FAIL because `src/components/MeetingProcessStatus.vue` does not exist.

- [ ] **Step 5: Implement the status component and design tokens**

Create `MeetingProcessStatus.vue` with this public contract:

```vue
<script setup>
const props = defineProps({
  phase: { type: String, default: 'record' },
  status: { type: String, default: '' },
  tone: { type: String, default: 'neutral' },
  retryable: Boolean
})
defineEmits(['retry'])
const phases = [
  { key: 'record', label: '记录' },
  { key: 'transcribe', label: '转写' },
  { key: 'organize', label: '整理' }
]
</script>
```

The template must render each phase with `data-phase`, use `aria-current="step"` only for `props.phase`, show `props.status` in a stable-height live region, and render a `data-action="retry"` button only when `retryable` is true.

Update Tailwind and global CSS with the approved tokens:

```js
colors: {
  canvas: '#F5F5F7', surface: '#FFFFFF', ink: '#1D1D1F',
  secondary: '#6E6E73', muted: '#8E8E93', line: '#E5E5E7',
  primary: '#0071E3', recording: '#FF3B30', success: '#34C759', warning: '#FF9500'
},
borderRadius: { control: '6px', panel: '8px' },
boxShadow: { document: '0 8px 30px rgba(0,0,0,0.055)' }
```

Define `.focus-ring`, `.icon-button`, `.command-button`, `.document-surface`, and a `prefers-reduced-motion` block in `src/style.css`. Remove the old `.card` abstraction and indigo `primary` scale only after all direct usages are migrated in later tasks.

- [ ] **Step 6: Run the focused test and commit**

Run: `npm.cmd run test:ui -- tests/ui/MeetingProcessStatus.spec.js`

Expected: 2 tests PASS.

```powershell
git add package.json package-lock.json vitest.config.js tests/ui/setup.js tests/ui/MeetingProcessStatus.spec.js src/components/MeetingProcessStatus.vue tailwind.config.js src/style.css
git commit -m "test: add UI test harness and design tokens"
```

## Task 2: Replace the Crowded Calendar Header

**Files:**
- Create: `tests/ui/CalendarToolbar.spec.js`
- Create: `src/components/CalendarToolbar.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Write the failing toolbar interaction test**

The test must mount with `view="month"` and `title="2026 年 7 月"`, click the `周` segment, previous arrow, Today, New Meeting, and overflow entries, then assert these exact events:

```js
expect(wrapper.emitted('update:view')[0]).toEqual(['week'])
expect(wrapper.emitted('navigate')[0]).toEqual([-1])
expect(wrapper.emitted('today')).toHaveLength(1)
expect(wrapper.emitted('create')).toHaveLength(1)
expect(wrapper.emitted('model-settings')).toHaveLength(1)
expect(wrapper.emitted('export-month')).toHaveLength(1)
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm.cmd run test:ui -- tests/ui/CalendarToolbar.spec.js`

Expected: FAIL because `CalendarToolbar.vue` does not exist.

- [ ] **Step 3: Implement `CalendarToolbar.vue`**

Use this interface:

```js
defineProps({ view: String, title: String })
defineEmits(['update:view', 'navigate', 'today', 'create', 'model-settings', 'export-month'])
```

Render two stable rows on desktop: product/segmented controls/New Meeting on row one, title/Today/previous/next on row two. Use Lucide `ChevronLeft`, `ChevronRight`, `Plus`, `Ellipsis`, `Settings`, and `FileDown`; the overflow menu must close after an action and on Escape.

- [ ] **Step 4: Integrate the toolbar into `App.vue`**

Replace the current header with:

```vue
<CalendarToolbar
  v-model:view="currentView"
  :title="viewTitle"
  @navigate="navigate"
  @today="goToday"
  @create="openNewRecord()"
  @model-settings="openModelSettings"
  @export-month="handleExportMonth"
/>
```

Keep all existing handler functions. Change `goToday()` so it preserves the selected view on desktop; mobile default-view behavior is implemented in Task 9.

- [ ] **Step 5: Verify and commit**

Run: `npm.cmd run test:ui -- tests/ui/CalendarToolbar.spec.js`

Expected: toolbar tests PASS.

Run: `npm.cmd run build`

Expected: Vite build exits 0.

```powershell
git add tests/ui/CalendarToolbar.spec.js src/components/CalendarToolbar.vue src/App.vue
git commit -m "feat: redesign calendar command header"
```

## Task 3: Redesign Month, Week, and Day Calendar Views

**Files:**
- Create: `tests/ui/CalendarViews.spec.js`
- Modify: `src/components/CalendarView.vue`
- Modify: `src/components/MonthView.vue`
- Modify: `src/components/WeekView.vue`
- Modify: `src/components/DayView.vue`

- [ ] **Step 1: Write failing behavior-preservation tests**

Create fixtures for a July 13 meeting and assert:

```js
expect(month.findAll('[data-calendar-cell]')).toHaveLength(42)
expect(month.get('[data-meeting-id="meeting-1"]').text()).toContain('季度目标讨论')
await month.get('[data-meeting-id="meeting-1"]').trigger('click')
expect(month.emitted('selectMeeting')[0][0].id).toBe('meeting-1')

await day.get('[data-time-slot="09:00"]').trigger('click')
expect(day.emitted('selectDate')[0]).toEqual(['2026-07-13'])
expect(week.get('[data-meeting-id="meeting-1"]').attributes('style')).toContain('top: 570px')
```

- [ ] **Step 2: Run and verify the expected failure**

Run: `npm.cmd run test:ui -- tests/ui/CalendarViews.spec.js`

Expected: FAIL because the stable `data-*` hooks do not exist.

- [ ] **Step 3: Apply the approved calendar anatomy**

Add `data-calendar-cell`, `data-meeting-id`, and `data-time-slot` hooks while preserving existing event emissions and positioning functions. Replace card wrappers with open white calendar surfaces, `#E5E5E7` hairlines, stable event blocks, a red circular Today date, and restrained category tints. Keep week/day timeline dimensions at 1440 px so meeting positions do not change.

- [ ] **Step 4: Verify all three views and commit**

Run: `npm.cmd run test:ui -- tests/ui/CalendarViews.spec.js`

Expected: all calendar tests PASS.

Run: `npm.cmd run build`

Expected: build exits 0 with no template warnings.

```powershell
git add tests/ui/CalendarViews.spec.js src/components/CalendarView.vue src/components/MonthView.vue src/components/WeekView.vue src/components/DayView.vue
git commit -m "feat: apply Time Horizon calendar styling"
```

## Task 4: Build the Shared Meeting Workspace Shell

**Files:**
- Create: `tests/ui/MeetingWorkspace.spec.js`
- Create: `src/components/MeetingWorkspace.vue`
- Create: `src/components/MeetingWorkspaceHeader.vue`

- [ ] **Step 1: Write failing workspace mode tests**

Test that desktop renders `data-region="document"` and `data-region="assistant"`, that the assistant toggle emits `update:assistantOpen`, and that the header emits `close`, `export`, and its mode-specific primary action.

Use this header assertion:

```js
expect(editHeader.get('[data-action="primary"]').text()).toBe('完成')
expect(readHeader.get('[data-action="primary"]').text()).toBe('编辑')
```

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd run test:ui -- tests/ui/MeetingWorkspace.spec.js`

Expected: FAIL because the workspace components do not exist.

- [ ] **Step 3: Implement the shell contracts**

`MeetingWorkspace.vue`:

```js
defineProps({ mode: { type: String, required: true }, assistantOpen: Boolean })
defineEmits(['update:assistantOpen'])
```

It must expose named slots `header`, `document`, and `assistant`; desktop uses `minmax(0,1fr) 294px`, tablet uses an overlay side drawer, and mobile uses a bottom sheet with `role="dialog"` and an accessible close button.

`MeetingWorkspaceHeader.vue`:

```js
defineProps({ mode: String, saveStatus: String, canExport: Boolean })
defineEmits(['close', 'export', 'complete', 'edit', 'toggle-assistant', 'more'])
```

Use Lucide icons and keep header height stable while save text appears or clears.

- [ ] **Step 4: Verify and commit**

Run: `npm.cmd run test:ui -- tests/ui/MeetingWorkspace.spec.js`

Expected: workspace tests PASS.

```powershell
git add tests/ui/MeetingWorkspace.spec.js src/components/MeetingWorkspace.vue src/components/MeetingWorkspaceHeader.vue
git commit -m "feat: add shared meeting workspace shell"
```

## Task 5: Extract the Meeting Document and Formatting Toolbar

**Files:**
- Create: `tests/ui/MeetingDocument.spec.js`
- Create: `src/components/MeetingDocument.vue`
- Create: `src/components/MeetingEditorToolbar.vue`

- [ ] **Step 1: Write failing document tests**

Mount edit mode with a meeting fixture, update the title, date, time, attendees, and content, and assert `update:modelValue` receives complete meeting objects. Mount read mode and assert there are no inputs or textareas and the content remains whitespace-preserving.

Test toolbar commands with:

```js
for (const command of ['heading', 'bold', 'italic', 'bullet', 'numbered', 'checkbox', 'quote', 'code', 'divider', 'template']) {
  await wrapper.get(`[data-command="${command}"]`).trigger('click')
}
expect(wrapper.emitted('command').map(event => event[0])).toEqual([
  'heading', 'bold', 'italic', 'bullet', 'numbered', 'checkbox', 'quote', 'code', 'divider', 'template'
])
```

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd run test:ui -- tests/ui/MeetingDocument.spec.js`

Expected: FAIL because both components are missing.

- [ ] **Step 3: Implement the document contract**

`MeetingDocument.vue` uses:

```js
const props = defineProps({ modelValue: { type: Object, required: true }, mode: { type: String, required: true } })
const emit = defineEmits(['update:modelValue', 'add-attendee', 'remove-attendee', 'content-keydown'])
const patch = values => emit('update:modelValue', { ...props.modelValue, ...values })
```

Expose the textarea element through `defineExpose({ focusContent, getContentElement })`. Render the toolbar through a named `toolbar` slot so `MeetingEditor.vue` retains command behavior. Read mode uses a `<pre>` with `white-space: pre-wrap` and the same document width/type scale.

- [ ] **Step 4: Implement the toolbar contract**

`MeetingEditorToolbar.vue` emits only `command`. Use Lucide icons for lists, checklist, quote, code, and divider; use text glyphs only for `H2`, `B`, and italic `I`. Every button must have a tooltip and accessible name.

- [ ] **Step 5: Verify and commit**

Run: `npm.cmd run test:ui -- tests/ui/MeetingDocument.spec.js`

Expected: document and toolbar tests PASS.

```powershell
git add tests/ui/MeetingDocument.spec.js src/components/MeetingDocument.vue src/components/MeetingEditorToolbar.vue
git commit -m "feat: add shared meeting document surface"
```

## Task 6: Build the Meeting Assistant Rail

**Files:**
- Create: `tests/ui/MeetingAssistant.spec.js`
- Create: `src/components/MeetingAssistant.vue`
- Modify: `src/components/MeetingProcessStatus.vue`

- [ ] **Step 1: Write failing assistant state tests**

Test idle, recording, transcribing, summarizing, success, and error props. Assert recording changes the command label to `结束会议录音`, conflicting actions are disabled while busy, empty content disables AI organization, and the exact events `record-toggle`, `upload`, `summarize`, `export-markdown`, `export-docx`, and `retry` are emitted.

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd run test:ui -- tests/ui/MeetingAssistant.spec.js`

Expected: FAIL because `MeetingAssistant.vue` does not exist.

- [ ] **Step 3: Implement the assistant API**

Use this explicit interface:

```js
defineProps({
  isRecording: Boolean,
  isFinishingRecording: Boolean,
  isTranscribing: Boolean,
  isSummarizing: Boolean,
  recordingSeconds: { type: Number, default: 0 },
  recordingStatus: { type: String, default: '' },
  asrStatus: { type: String, default: '' },
  summaryStatus: { type: String, default: '' },
  hasContent: Boolean,
  canExport: Boolean,
  retryKind: { type: String, default: '' },
  modelLabel: { type: String, default: 'Qwen3 8B' }
})
defineEmits(['record-toggle', 'upload', 'summarize', 'export-markdown', 'export-docx', 'retry'])
```

Derive the process phase in the order recording -> transcribing -> summarizing/complete. Preserve a fixed status area, use red only for active recording, and never show an unconfirmed “audio saved” message. Render Retry only when `retryKind` is `record` or `summarize`, and emit that exact string. ASR upload errors return to the existing Upload Audio action because the cleared file input does not retain a retryable file.

- [ ] **Step 4: Verify and commit**

Run: `npm.cmd run test:ui -- tests/ui/MeetingAssistant.spec.js`

Expected: assistant tests PASS.

```powershell
git add tests/ui/MeetingAssistant.spec.js src/components/MeetingAssistant.vue src/components/MeetingProcessStatus.vue
git commit -m "feat: add meeting recording and AI assistant rail"
```

## Task 7: Integrate the New Workspace into MeetingEditor

**Files:**
- Create: `tests/ui/MeetingEditor.spec.js`
- Modify: `src/components/MeetingEditor.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Write failing integration tests with mocked clients**

Mock `useApi`, `useAsr`, `useLocalRecording`, and `useSummarizer`. Mount initial data and assert the document fields render, toolbar `bold` inserts `**`, upload calls `transcribeAudio`, summarize calls `summarizeContent`, and Complete emits a cloned meeting payload.

Include the save assertion:

```js
await wrapper.get('[data-field="title"]').setValue('第三季度产品规划会')
await wrapper.get('[data-action="complete"]').trigger('click')
expect(wrapper.emitted('save')[0][0]).toMatchObject({
  title: '第三季度产品规划会',
  attendees: []
})
```

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd run test:ui -- tests/ui/MeetingEditor.spec.js`

Expected: FAIL because the existing editor does not expose the approved structure and hooks.

- [ ] **Step 3: Compose the approved editor without rewriting behavior**

Keep the current reactive form, autosave, recording, ASR, summarizer, Markdown insertion, keyboard, and lifecycle functions. Replace only the template and add these adapters:

```js
const applyFormUpdate = next => Object.assign(form, next)
const toolbarCommands = {
  heading: insertHeading, bold: insertBold, italic: insertItalic,
  bullet: insertBullet, numbered: insertNumbered, checkbox: insertCheckbox,
  quote: insertQuote, code: insertCode, divider: insertDivider, template: insertTemplate
}
function runToolbarCommand(command) { toolbarCommands[command]?.() }
```

Compose `MeetingWorkspace`, `MeetingWorkspaceHeader`, `MeetingDocument`, `MeetingEditorToolbar`, and `MeetingAssistant`. Keep the hidden audio input in `MeetingEditor.vue`. Add an `export` emit that is disabled until `form.id` exists; `App.vue` routes it to the existing `handleExport`.

Because the textarea moves into `MeetingDocument`, add a `documentRef` and replace every direct `contentRef.value` lookup in the existing cursor/keyboard functions with:

```js
const documentRef = ref(null)
const getContentElement = () => documentRef.value?.getContentElement()
```

Use `getContentElement()` in `insertAtCursor`, `replaceAtCursor`, `handleEnterKey`, `onKeydown`, summary-focus handling, and the mounted focus call. Emit export as `emit('export', { ...form, attendees: [...form.attendees] }, format)`, and bind `@export="handleExport"` in `App.vue`; the argument order is always `(meeting, format)`.

- [ ] **Step 4: Verify editor behavior and existing server clients**

Run:

```powershell
npm.cmd run test:ui -- tests/ui/MeetingEditor.spec.js tests/ui/MeetingAssistant.spec.js tests/ui/MeetingDocument.spec.js
npm.cmd run test:server
```

Expected: focused UI tests PASS and all existing Node tests PASS.

- [ ] **Step 5: Commit the editor integration**

```powershell
git add tests/ui/MeetingEditor.spec.js src/components/MeetingEditor.vue src/App.vue
git commit -m "feat: compose the redesigned meeting editor"
```

## Task 8: Rebuild Meeting Detail on the Shared Workspace

**Files:**
- Create: `tests/ui/MeetingDetail.spec.js`
- Create: `src/components/MeetingInfoPanel.vue`
- Modify: `src/components/MeetingDetail.vue`

- [ ] **Step 1: Write the failing read-mode test**

Mount a saved meeting and assert title, raw content, attendees, created/updated dates, and `已整理` render. Click Back, Edit, DOCX export, Markdown export, and Delete; assert `close`, `edit`, `export` with the requested format, and `delete` with the meeting ID.

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd run test:ui -- tests/ui/MeetingDetail.spec.js`

Expected: FAIL because the old detail view has no shared workspace or format-specific events.

- [ ] **Step 3: Implement `MeetingInfoPanel` and compose read mode**

Use:

```js
defineProps({ meeting: { type: Object, required: true } })
defineEmits(['export-markdown', 'export-docx', 'delete'])
```

Update `MeetingDetail.vue` to compose `MeetingWorkspace`, `MeetingWorkspaceHeader`, `MeetingDocument mode="read"`, and `MeetingInfoPanel`. Keep deletion confirmation in `App.vue`. Change `handleExport` to accept `format = 'docx'` and pass that exact format to `api.exportMeeting`.

- [ ] **Step 4: Verify and commit**

Run: `npm.cmd run test:ui -- tests/ui/MeetingDetail.spec.js`

Expected: detail tests PASS.

```powershell
git add tests/ui/MeetingDetail.spec.js src/components/MeetingInfoPanel.vue src/components/MeetingDetail.vue src/App.vue
git commit -m "feat: align meeting detail with the document workspace"
```

## Task 9: Extract Settings, Finish Responsive Behavior, and Accessibility

**Files:**
- Create: `tests/ui/ModelSettingsDialog.spec.js`
- Create: `tests/ui/AppResponsive.spec.js`
- Create: `src/components/ModelSettingsDialog.vue`
- Modify: `src/App.vue`
- Modify: `src/components/CalendarToolbar.vue`
- Modify: `src/components/MeetingWorkspace.vue`
- Modify: `src/style.css`

- [ ] **Step 1: Write failing dialog and mobile tests**

Test that the settings dialog traps its visible controls under `role="dialog"`, Escape emits `close`, Test emits `test`, Save emits `save` with the current URL, and status text uses `aria-live="polite"`. In `tests/ui/AppResponsive.spec.js`, mock `matchMedia('(max-width: 767px)')` as true before mounting `App.vue` and assert the initial selected calendar view is `day`.

- [ ] **Step 2: Run and verify failure**

Run: `npm.cmd run test:ui -- tests/ui/ModelSettingsDialog.spec.js tests/ui/AppResponsive.spec.js`

Expected: FAIL because the dialog component and mobile initialization do not exist.

- [ ] **Step 3: Extract the dialog and add responsive initialization**

`ModelSettingsDialog.vue` uses:

```js
defineProps({ modelValue: String, loading: Boolean, saving: Boolean, status: String })
defineEmits(['update:modelValue', 'close', 'test', 'save'])
```

In `App.vue`, initialize with:

```js
const mobileQuery = window.matchMedia('(max-width: 767px)')
const currentView = ref(mobileQuery.matches ? 'day' : 'month')
```

Do not auto-switch an existing user-selected view on later resize. Complete responsive layouts at the approved `1100px` and `768px` breakpoints, visible focus states, `aria-expanded`, Escape closing, touch target sizing, and reduced-motion behavior.

- [ ] **Step 4: Run UI accessibility checks and commit**

Run: `npm.cmd run test:ui`

Expected: every UI test PASS with no Vue warnings about mutated props or missing keys.

Run: `npm.cmd run build`

Expected: build exits 0.

```powershell
git add tests/ui/ModelSettingsDialog.spec.js tests/ui/AppResponsive.spec.js src/components/ModelSettingsDialog.vue src/App.vue src/components/CalendarToolbar.vue src/components/MeetingWorkspace.vue src/style.css
git commit -m "feat: finish responsive and accessible UI behavior"
```

## Task 10: Browser Workflow, Visual Fidelity, and Progress Handoff

**Files:**
- Create: `playwright.config.js`
- Create: `tests/e2e/ui-redesign.spec.js`
- Modify: `E:\Objects\MeetingRecord\PROJECT_PROGRESS.md`

- [ ] **Step 1: Add deterministic Playwright routing and workflow tests**

Configure Playwright to start `npm.cmd run dev -- --host 127.0.0.1 --port 5174` and use `http://127.0.0.1:5174`. In the E2E test, intercept `/api/meetings*`, `/api/settings/model-gateway`, and model health requests with deterministic fixtures. Cover:

```js
await page.getByRole('button', { name: '新建会议' }).click()
await page.getByLabel('会议标题').fill('第三季度产品规划会')
await page.getByRole('button', { name: '插入会议模板' }).click()
await expect(page.getByLabel('会议正文')).toHaveValue(/会议议题/)
await page.getByRole('button', { name: '完成' }).click()
await expect(page.getByText('第三季度产品规划会')).toBeVisible()
```

Also verify month/week/day switching, opening detail, edit, export command visibility, assistant drawer opening on mobile, and no horizontal overflow.

- [ ] **Step 2: Run the full automated baseline**

Run:

```powershell
npm.cmd test
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Expected: all existing Node tests, all UI tests, the build, and all E2E tests PASS.

- [ ] **Step 3: Capture the required viewports**

Capture calendar, new meeting, recording state, transcription error state, and meeting detail at:

```text
1440x900
1280x800
390x844
```

Save temporary QA screenshots under `.superpowers/qa/ui-redesign/`. Do not commit them unless the user explicitly requests visual artifacts in Git.

- [ ] **Step 4: Perform the fidelity ledger**

Use `view_image` on each accepted concept and the matching latest screenshot. Record and repair mismatches for at least these points:

```text
1. Calendar header hierarchy and action labels
2. Calendar density, event blocks, and Today treatment
3. Document width, title scale, and metadata rhythm
4. Assistant rail width, process line, and command order
5. Borders, 6-8px radii, shadows, and palette
6. Mobile drawer/bottom-sheet behavior and text wrapping
7. Icon metaphor, stroke weight, alignment, and tooltips
```

Repeat screenshots after repairs. Completion requires no clipping, overlap, inert controls, invented copy, or unexplained concept drift.

- [ ] **Step 5: Update the canonical progress file**

Update `E:\Objects\MeetingRecord\PROJECT_PROGRESS.md` with the final commit hashes, exact test counts, build result, browser viewports, remaining intentional deviations, and this next-step statement:

```text
UI redesign is implemented and verified locally. Cloud deployment has not been performed; deploy only after an explicit user request.
```

- [ ] **Step 6: Run the final clean verification and commit**

Run:

```powershell
git diff --check
npm.cmd test
npm.cmd run build
npm.cmd run test:e2e
git status --short
```

Expected: checks PASS; status contains only pre-existing unrelated worktree changes and any explicitly documented QA artifacts.

```powershell
git add playwright.config.js tests/e2e/ui-redesign.spec.js
git commit -m "test: verify redesigned meeting workflows"
```

Do not stage the root worktree progress file from this feature worktree. Preserve it in place and report its status separately.
