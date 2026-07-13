# Meeting Assistant UI Redesign Design

**Date:** 2026-07-13
**Status:** User-approved design, pending implementation plan
**Target:** `meeting-assistant` in the `feature/asr-service` worktree

## 1. Objective

Redesign the Meeting Assistant UI with an Apple-like, precise, lightweight visual language while preserving the existing meeting workflow and product capabilities. The primary experience targets desktop browsers. Mobile remains supported through responsive adaptations rather than a separate product flow.

The approved direction is **A: Time Horizon**. It keeps the calendar familiar, makes the meeting document the visual center of the editor, and moves recording, transcription, AI summarization, and export into a stable assistant rail.

## 2. Approved Concept Artifacts

The following browser companion screens were reviewed and approved:

- `.superpowers/brainstorm/ui-redesign-20260713/content/visual-directions.html`
- `.superpowers/brainstorm/ui-redesign-20260713/content/editor-workspace.html`
- `.superpowers/brainstorm/ui-redesign-20260713/content/meeting-detail.html`

The built-in image generation tool was unavailable during this design session, so the approved concepts are interactive HTML/CSS mockups. Implementation must use browser screenshots of these mockups as its visual comparison baseline.

## 3. Scope

### In scope

- Redesign the month, week, and day calendar surfaces.
- Reorganize the calendar header and move low-frequency actions into menus.
- Redesign meeting creation and editing as a document workspace with an assistant rail.
- Redesign meeting detail as the read-only state of the same workspace.
- Unify recording, upload, transcription, summarization, success, and error statuses.
- Add a compact design token layer for color, typography, spacing, borders, radii, and shadows.
- Split UI responsibilities currently concentrated in `MeetingEditor.vue`.
- Preserve desktop density and add deliberate tablet and mobile behavior.

### Out of scope

- Backend API changes.
- Meeting schema or storage format changes.
- New synchronization, recovery, or audio retention behavior.
- Changes to ASR, Ollama, Cloudflare Tunnel, D1, authentication, or deployment.
- Cloud deployment as part of the UI implementation.
- New product modules such as search, tags, templates management, or a separate minutes library.

## 4. Visual System

### 4.1 Palette

| Role | Value | Usage |
|---|---|---|
| App background | `#F5F5F7` | Calendar and workspace backdrop |
| Primary surface | `#FFFFFF` | Documents, controls, menus |
| Primary text | `#1D1D1F` | Titles and important labels |
| Secondary text | `#6E6E73` | Metadata and supporting text |
| Muted text | `#8E8E93` | Hints and inactive states |
| Divider | `#E5E5E7` | Grid and section boundaries |
| Primary action | `#0071E3` | Create, complete, selected controls |
| Recording | `#FF3B30` | Recording-only active states |
| Success | `#34C759` | Saved, connected, and completed states |
| Warning | `#FF9500` | Recoverable failure and degraded states |

Calendar event categories may use restrained blue, green, orange, and violet tints. The page must not become a one-hue blue interface.

### 4.2 Typography

- Use the native Apple-style system stack: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Display`, `PingFang SC`, `Microsoft YaHei`, `sans-serif`.
- Use weight and whitespace for hierarchy. Avoid negative letter spacing and viewport-scaled font sizes.
- Calendar and tool chrome use compact, deliberate sizes. Meeting document titles use the largest type in the operational UI, but remain below hero scale.
- Markdown content may retain a code-friendly font only where raw syntax needs it. The surrounding document chrome uses the system stack.

### 4.3 Shape and depth

- Control and panel radii stay between 6 and 8 pixels.
- Use hairline separators before shadows.
- Use one subtle document shadow to establish hierarchy; do not turn every section into a card.
- Do not nest decorative cards.
- Use familiar icons for navigation, search, menus, recording, upload, export, and formatting. Text labels remain for commands whose result is not obvious from an icon alone.

### 4.4 Signature element

The meeting process line is the single distinctive visual element. It presents **Record -> Transcribe -> Organize** as a restrained progression in the assistant rail. It provides stable placement for active, waiting, success, and error states without adding decoration elsewhere.

## 5. Surface Design

### 5.1 Calendar

- Keep the month calendar full width on desktop.
- The primary header contains product identity, month/week/day segmented control, search or overflow access, and the New Meeting action.
- The date heading, Today button, and previous/next navigation form a second, quieter row.
- Model settings, monthly export, and other low-frequency actions move into a labeled overflow menu.
- Month, week, and day views share typography, event colors, selected-day treatment, and navigation controls.
- Event blocks have stable dimensions and truncation behavior so hover or long titles do not shift the grid.

### 5.2 Meeting workspace

- Editing and reading share a common `MeetingWorkspace` shell.
- The main column contains a centered white document with title, meeting metadata, attendees, formatting controls, and free-form content.
- The right rail contains the Meeting Assistant. In edit mode it exposes recording, audio upload, transcription, AI minutes generation, and document export.
- The top bar contains Back, save state, context title, overflow, Export, and Complete/Edit actions.
- The formatting toolbar remains close to the document and may become sticky within the document scroll area.
- Existing fields and keyboard behavior remain intact.

### 5.3 Read-only meeting detail

- Display the saved content in the same document dimensions and typography as edit mode.
- Replace creation tools in the right rail with meeting metadata, attendee information, export actions, and deletion.
- Preserve Edit, Export, Delete, and Back capabilities.
- Do not transform the stored free-form Markdown into a new structured database model.

### 5.4 Settings and menus

- Model settings and export format selection use compact popovers or dialogs, not permanent top-level toolbar items.
- Menus use explicit labels, keyboard focus, and destructive action separation.
- Existing settings capabilities and values remain unchanged.

## 6. Responsive Behavior

- **Above 1100 px:** document plus fixed assistant rail.
- **768-1099 px:** assistant rail is collapsible and opens as a side drawer.
- **Below 768 px:** single-column document; the assistant opens as a bottom sheet. Primary actions remain in a stable compact header.
- Mobile calendar defaults to the day view. Users can still select week or month view, but the full month grid is not compressed into unreadable cells.
- Long titles, attendee names, action labels, and status messages must wrap or truncate without overlapping neighboring controls.

## 7. Component Architecture

The redesign introduces bounded presentation components without changing the business composables:

| Component | Responsibility |
|---|---|
| `CalendarToolbar` | View switch, date navigation, create action, overflow menu |
| `MeetingWorkspace` | Shared edit/read layout and responsive assistant behavior |
| `MeetingWorkspaceHeader` | Back, save state, export, complete/edit, overflow |
| `MeetingDocument` | Title, metadata, attendees, content surface |
| `MeetingEditorToolbar` | Markdown insertion commands and template action |
| `MeetingAssistant` | Recording, upload, transcription, summarization, export |
| `MeetingProcessStatus` | Record/transcribe/organize progress and errors |
| `MeetingInfoPanel` | Read-only metadata, attendees, export, delete |

`App.vue` continues coordinating the selected calendar period and active meeting state. Existing `useApi`, `useAsr`, `useLocalRecording`, `useSummarizer`, and date utilities remain the behavior boundary. The large `MeetingEditor.vue` is decomposed only where required to implement the approved workspace.

## 8. Data and Interaction Flow

### 8.1 Meeting editing

1. Opening New Meeting creates the current local form state.
2. Metadata and content edits update that state.
3. Existing minute-based autosave persists non-empty content.
4. Complete validates the title, persists the meeting, and returns to the calendar.
5. Save progress appears in the workspace header, not inside the editor toolbar.

### 8.2 Recording

1. Check the local recording service.
2. Request microphone permission.
3. Start the recording session and ordered chunk uploads.
4. Show duration and the Stop action in the assistant rail.
5. Finish recording, wait for chunk uploads, request merge/transcription/summary, and append the returned content through the existing behavior.

### 8.3 Audio upload and AI minutes

- Audio upload uses the existing ASR client and appends formatted transcript text.
- AI minutes uses the current editor content and merges the summary through the existing summarizer behavior.
- Recording, transcription, and summarization remain mutually exclusive where the current implementation requires it.

## 9. Status and Error Handling

- Progress and error messages have one stable location in `MeetingAssistant`.
- Disabled actions remain visibly disabled and expose a clear reason through surrounding status text or a tooltip.
- Autosave failure keeps the in-memory form and never closes the workspace.
- ASR, model, tunnel, and recording errors show the concrete message returned by the current clients when safe, plus a retry action only when the same operation can be invoked again.
- The redesign does not claim audio preservation, recovery, or server availability unless confirmed by the existing backend response.
- Success messages identify the result, for example “Transcript added” or “Minutes generated,” and clear after a short interval without shifting layout.

## 10. Accessibility and Motion

- All icon-only controls have accessible names and visible tooltips where meaning is not universal.
- Keyboard focus is clearly visible across headers, menus, form fields, editor tools, and dialogs.
- Color is not the only status indicator; text and shape accompany recording, warning, and success colors.
- Motion is limited to short menu, drawer, save-state, and process-line transitions.
- Respect `prefers-reduced-motion`.
- Minimum interactive target size is 32 px on desktop and 40 px on touch layouts.

## 11. Verification

Implementation is complete only when all of the following pass:

1. Existing Node test suite.
2. Production Vite build.
3. Focused component tests for workspace modes, assistant states, action events, and responsive controls.
4. Calendar browsing, create/edit, autosave, detail, export, audio upload, recording state, and AI summary smoke checks.
5. Browser screenshots at `1440x900`, `1280x800`, and `390x844`.
6. Direct visual comparison of accepted concept screenshots and implementation screenshots using `view_image`.
7. No clipping, unintended wrapping, overlap, mobile overflow, browser-default control typography, or inert controls.

The implementation does not include cloud deployment. The cloud site changes only after a separate explicit deployment request.
