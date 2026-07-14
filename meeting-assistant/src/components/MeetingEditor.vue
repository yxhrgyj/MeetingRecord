<script setup>
import { computed, reactive, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useApi } from '@/composables/useApi.js'
import { formatTranscriptForEditor, useAsr } from '@/composables/useAsr.js'
import { useLocalRecording } from '@/composables/useLocalRecording.js'
import { useSummarizer } from '@/composables/useSummarizer.js'
import { useDateUtils } from '@/composables/useDateUtils.js'
import {
  normalizeMeetingSummary,
  parseMeetingContent,
  serializeMeetingContent
} from '@/domain/meetingContent.js'
import MeetingAssistant from '@/components/MeetingAssistant.vue'
import MeetingDocument from '@/components/MeetingDocument.vue'
import MeetingEditorToolbar from '@/components/MeetingEditorToolbar.vue'
import MeetingWorkspace from '@/components/MeetingWorkspace.vue'
import MeetingWorkspaceHeader from '@/components/MeetingWorkspaceHeader.vue'

const props = defineProps({ initialData: Object })
const emit = defineEmits(['save', 'close', 'export'])

const dt = useDateUtils()
const api = useApi()
const asr = useAsr()
const localRecording = useLocalRecording()
const summarizer = useSummarizer()

const form = reactive({
  id: '',
  title: '',
  date: dt.formatDate(new Date()),
  startTime: '',
  endTime: '',
  attendees: [],
  summary: '',
  transcript: ''
})

const documentRef = ref(null)
const audioInputRef = ref(null)
const assistantOpen = ref(false)
const activeSection = ref('summary')
const isTranscribing = ref(false)
const isSummarizing = ref(false)
const isRecording = ref(false)
const isFinishingRecording = ref(false)
const asrStatus = ref('')
const summaryStatus = ref('')
const recordingStatus = ref('')
const mediaRecorder = ref(null)
const mediaStream = ref(null)
const recordingSession = ref(null)
const recordingChunkIndex = ref(0)
const recordingUploads = ref([])
const recordingTimer = ref(null)
const recordingSeconds = ref(0)
const autoSaveTimer = ref(null)
const autoSaveLabel = ref('')

const retryKind = computed(() => {
  if (/失败|不可用|异常|错误/.test(summaryStatus.value)) return 'summarize'
  if (/失败|不可用|异常|错误/.test(recordingStatus.value)) return 'record'
  return ''
})

function initForm() {
  if (props.initialData) {
    form.id = props.initialData.id || ''
    form.title = props.initialData.title || ''
    form.date = props.initialData.date || dt.formatDate(new Date())
    form.startTime = props.initialData.startTime || ''
    form.endTime = props.initialData.endTime || ''
    form.attendees = [...(props.initialData.attendees || [])]
    const sections = parseMeetingContent(props.initialData.content)
    form.summary = sections.summary
    form.transcript = sections.transcript
  }
}

// ===== 参会人标签 =====
function addAttendee(value) {
  const name = String(value || '').trim()
  if (name && !form.attendees.includes(name)) {
    form.attendees.push(name)
  }
}
function removeAttendee(i) { form.attendees.splice(i, 1) }

function applyFormUpdate(nextForm) {
  Object.assign(form, nextForm)
}

const activeContent = computed({
  get: () => form[activeSection.value],
  set: value => {
    form[activeSection.value] = value
  }
})

function buildMeetingPayload() {
  const { summary, transcript, ...metadata } = form
  return {
    ...metadata,
    attendees: [...form.attendees],
    content: serializeMeetingContent({ summary, transcript })
  }
}

function getContentElement() {
  return documentRef.value?.getContentElement?.()
}

// ===== 快捷记录时间 =====
function recordStartTime() {
  const now = new Date()
  form.startTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
}
function recordEndTime() {
  const now = new Date()
  form.endTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
}

// ===== 快捷插入 =====
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

function insertHeading()    { insertAtCursor('\n## ') }
function insertSubheading() { insertAtCursor('\n### ') }
function insertBold()       { insertAtCursor('**', '**') }
function insertItalic()     { insertAtCursor('*', '*') }
function insertBullet()     { insertAtCursor('\n- ') }
function insertNumbered()   { insertAtCursor('\n1. ') }
function insertCheckbox()   { insertAtCursor('\n- [ ] ') }
function insertDivider()    { insertAtCursor('\n---\n') }
function insertCode()       { insertAtCursor('\n```\n', '\n```\n') }
function insertQuote()      { insertAtCursor('\n> ') }

function insertTemplate() {
  const tpl = `
## 会议议题

1.

## 讨论要点



## 会议决议

1.

## 待办事项

- [ ]  负责人:  截止:
- [ ]  负责人:  截止:

## 备注

`
  insertAtCursor(tpl)
}

const toolbarCommands = {
  heading: insertHeading,
  subheading: insertSubheading,
  bold: insertBold,
  italic: insertItalic,
  bullet: insertBullet,
  numbered: insertNumbered,
  checkbox: insertCheckbox,
  quote: insertQuote,
  code: insertCode,
  divider: insertDivider,
  template: insertTemplate
}

function runToolbarCommand(command) {
  toolbarCommands[command]?.()
}

// ===== ASR 音频转写 =====
function chooseAudioFile() {
  if (!isTranscribing.value) audioInputRef.value?.click()
}

async function handleAudioSelected(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  isTranscribing.value = true
  asrStatus.value = 'ASR 转写中...'
  try {
    const result = await asr.transcribeAudio(file)
    const transcript = formatTranscriptForEditor(result)
    if (!transcript) {
      asrStatus.value = 'ASR 未识别到文本'
      return
    }
    const prefix = form.transcript.trim() ? '\n\n' : ''
    form.transcript = `${form.transcript.trimEnd()}${prefix}${transcript}`
    activeSection.value = 'transcript'
    asrStatus.value = 'ASR 已插入'
    setTimeout(() => {
      if (asrStatus.value === 'ASR 已插入') asrStatus.value = ''
    }, 3000)
  } catch (error) {
    console.error('ASR 转写失败:', error)
    asrStatus.value = error?.message || 'ASR 服务不可用'
  } finally {
    isTranscribing.value = false
  }
}

// ===== 本机会议录音 =====
function getRecordingMimeType() {
  if (!window.MediaRecorder) return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
  ]
  return candidates.find((mimeType) => window.MediaRecorder.isTypeSupported(mimeType)) || ''
}

function formatRecordingDuration(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function startRecordingTimer() {
  recordingSeconds.value = 0
  if (recordingTimer.value) clearInterval(recordingTimer.value)
  recordingTimer.value = setInterval(() => {
    recordingSeconds.value += 1
    if (isRecording.value) {
      recordingStatus.value = `录音中 ${formatRecordingDuration(recordingSeconds.value)}`
    }
  }, 1000)
}

function stopRecordingTimer() {
  if (recordingTimer.value) {
    clearInterval(recordingTimer.value)
    recordingTimer.value = null
  }
}

function stopRecordingTracks() {
  mediaStream.value?.getTracks?.().forEach((track) => track.stop())
  mediaStream.value = null
}

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
  nextTick(() => documentRef.value?.scrollToSectionTop?.())
}

async function startMeetingRecording() {
  if (isRecording.value || isFinishingRecording.value) return
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    recordingStatus.value = '当前浏览器不支持录音'
    return
  }

  const mimeType = getRecordingMimeType()
  if (!mimeType) {
    recordingStatus.value = '当前浏览器不支持 WebM 录音'
    return
  }

  try {
    recordingStatus.value = '检测本机服务...'
    await localRecording.checkHealth()
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const session = await localRecording.startRecording({
      title: form.title,
      date: form.date,
      startTime: form.startTime
    })

    if (!form.startTime) recordStartTime()
    mediaStream.value = stream
    recordingSession.value = session
    recordingChunkIndex.value = 0
    recordingUploads.value = []
    mediaRecorder.value = new MediaRecorder(stream, { mimeType })
    mediaRecorder.value.ondataavailable = (event) => {
      if (!event.data?.size || !recordingSession.value) return
      const index = recordingChunkIndex.value
      recordingChunkIndex.value += 1
      const upload = localRecording.uploadChunk({
        recordingId: recordingSession.value.id,
        index,
        blob: event.data
      })
      recordingUploads.value.push(upload)
    }
    mediaRecorder.value.onstop = finishMeetingRecording
    mediaRecorder.value.start(30000)
    isRecording.value = true
    recordingStatus.value = '录音中 00:00'
    startRecordingTimer()
  } catch (error) {
    console.error('开始会议录音失败:', error)
    recordingStatus.value = error?.message || '本机录音服务不可用'
    stopRecordingTimer()
    stopRecordingTracks()
    isRecording.value = false
    recordingSession.value = null
  }
}

function stopMeetingRecording() {
  if (!isRecording.value || !mediaRecorder.value) return
  isRecording.value = false
  isFinishingRecording.value = true
  recordingStatus.value = '结束录音，正在整理...'
  recordEndTime()
  stopRecordingTimer()
  mediaRecorder.value.stop()
}

async function finishMeetingRecording() {
  try {
    stopRecordingTracks()
    await Promise.all(recordingUploads.value)
    const result = await localRecording.finishRecording(recordingSession.value.id)
    appendRecordingResult(result)
    recordingStatus.value = `录音已整理 ${formatRecordingDuration(recordingSeconds.value)}`
    setTimeout(() => {
      if (recordingStatus.value.startsWith('录音已整理')) recordingStatus.value = ''
    }, 5000)
  } catch (error) {
    console.error('会议录音整理失败:', error)
    recordingStatus.value = error?.message || '会议录音整理失败'
  } finally {
    isFinishingRecording.value = false
    mediaRecorder.value = null
    recordingSession.value = null
    recordingUploads.value = []
  }
}

// ===== LLM 会议纪要整理 =====
async function handleSummarize() {
  if (isSummarizing.value) return
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
}

// ===== 自动保存（每分钟） =====
function startAutoSave() {
  autoSaveTimer.value = setInterval(doAutoSave, 60000)
}

function stopAutoSave() {
  if (autoSaveTimer.value) {
    clearInterval(autoSaveTimer.value)
    autoSaveTimer.value = null
  }
}

async function doAutoSave() {
  // 没有任何实质内容时不保存
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
  } catch (e) {
    console.error('自动保存失败:', e)
    autoSaveLabel.value = '自动保存失败'
    setTimeout(() => {
      if (autoSaveLabel.value === '自动保存失败') autoSaveLabel.value = prevLabel
    }, 3000)
  }
}

// ===== 手动保存并返回 =====
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

function handleRetry(kind) {
  if (kind === 'record') startMeetingRecording()
  if (kind === 'summarize') handleSummarize()
}

// ===== 向上查找列表祖先（用于 Shift+Enter 软换行后仍能续号）=====
function findListAncestor(text) {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]
    const num = l.match(/^(\d+)\.\s+.+$/)
    if (num) return { type: 'number', next: parseInt(num[1]) + 1 }
    const chk = l.match(/^-\s*\[[ x]\]\s+.+$/)
    if (chk) return { type: 'checkbox' }
    const bul = l.match(/^-\s+.+$/)
    if (bul) return { type: 'bullet' }
    // 遇到空行说明不在同一个列表块内
    if (l.trim() === '') break
  }
  return null
}

// ===== 插入新编号行后，将后续编号全部 +1 =====
// 从 startNum 开始，对后续所有编号行进行顺序重编号（而非简单 +1），避免重复累计
function renumberAfter(text, startNum) {
  const lines = text.split('\n')
  let counter = startNum
  let started = false
  for (let i = 0; i < lines.length; i++) {
    if (!started && lines[i].trim() === '') continue // 跳过开头空行
    started = true
    if (lines[i].trim() === '') break // 列表内部空行才停止
    if (/^\d+\.\s/.test(lines[i])) {
      lines[i] = lines[i].replace(/^\d+\.\s/, counter + '. ')
      counter++
    }
  }
  return lines.join('\n')
}

// ===== 回车自动续号 =====
function handleEnterKey(e) {
  const el = getContentElement()
  if (!el) return

  const pos = el.selectionStart
  const beforeCursor = activeContent.value.substring(0, pos)
  const afterCursor = activeContent.value.substring(pos)
  const lastNewline = beforeCursor.lastIndexOf('\n')
  const line = beforeCursor.substring(lastNewline + 1)

  // 编号列表: "1. 内容" 或 "1. "
  const numMatch = line.match(/^(\d+)\.\s+(.+)$/)
  const emptyNumMatch = line.match(/^(\d+)\.\s*$/)
  // 待办: "- [ ] 内容" 或 "- [x] 内容"
  const chkMatch = line.match(/^-\s*\[([ x])\]\s+(.+)$/)
  const emptyChkMatch = line.match(/^-\s*\[([ x])\]\s*$/)
  // 无序列表: "- 内容" 或 "- "
  const bulMatch = line.match(/^-\s+(.+)$/)
  const emptyBulMatch = line.match(/^-\s*$/)

  if (numMatch) {
    e.preventDefault()
    const next = parseInt(numMatch[1]) + 1
    const renumbered = renumberAfter(afterCursor, next + 1)
    activeContent.value = beforeCursor + '\n' + next + '. ' + renumbered
    nextTick(() => {
      el.focus()
      // pos + 1(\n) + next.length + 2(". ") = 新编号行末尾
      el.setSelectionRange(pos + 1 + String(next).length + 2, pos + 1 + String(next).length + 2)
    })
    return
  }
  if (emptyNumMatch) {
    e.preventDefault()
    activeContent.value = beforeCursor.substring(0, lastNewline + 1) + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(lastNewline + 1, lastNewline + 1)
    })
    return
  }
  if (chkMatch) {
    e.preventDefault()
    activeContent.value = beforeCursor + '\n- [ ] ' + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(pos + 7, pos + 7)
    })
    return
  }
  if (emptyChkMatch) {
    e.preventDefault()
    activeContent.value = beforeCursor.substring(0, lastNewline + 1) + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(lastNewline + 1, lastNewline + 1)
    })
    return
  }
  if (bulMatch) {
    e.preventDefault()
    activeContent.value = beforeCursor + '\n- ' + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(pos + 3, pos + 3)
    })
    return
  }
  if (emptyBulMatch) {
    e.preventDefault()
    activeContent.value = beforeCursor.substring(0, lastNewline + 1) + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(lastNewline + 1, lastNewline + 1)
    })
    return
  }

  // 当前行不匹配任何列表标记，但可能在列表内部（Shift+Enter 软换行后）
  if (line.trim() === '') return // 空行，不做特殊处理

  const ancestor = findListAncestor(beforeCursor)
  if (!ancestor) return // 无列表祖先，普通回车

  e.preventDefault()
  if (ancestor.type === 'number') {
    const renumbered = renumberAfter(afterCursor, ancestor.next + 1)
    activeContent.value = beforeCursor + '\n' + ancestor.next + '. ' + renumbered
    nextTick(() => {
      el.focus()
      // pos + 1(\n) + next.length + 2(". ") = 新编号行末尾
      el.setSelectionRange(pos + 1 + String(ancestor.next).length + 2, pos + 1 + String(ancestor.next).length + 2)
    })
  } else if (ancestor.type === 'checkbox') {
    activeContent.value = beforeCursor + '\n- [ ] ' + afterCursor
    nextTick(() => { el.focus(); el.setSelectionRange(pos + 7, pos + 7) })
  } else if (ancestor.type === 'bullet') {
    activeContent.value = beforeCursor + '\n- ' + afterCursor
    nextTick(() => { el.focus(); el.setSelectionRange(pos + 3, pos + 3) })
  }
}

// ===== 快捷键 =====
function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    handleSubmit()
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    insertAtCursor('  ')
    return
  }
  if (e.key === 'Enter') {
    // Shift+Enter：软换行，保持缩进与上一行文字对齐
    if (e.shiftKey) {
      e.preventDefault()
      const el = getContentElement()
      if (!el) return
      const pos = el.selectionStart
      const before = activeContent.value.substring(0, pos)
      const lastNL = before.lastIndexOf('\n')
      const curLine = before.substring(lastNL + 1)

      // 计算缩进：优先沿用当前行的前导空格，否则按列表标记宽度计算
      let indent = ''
      const leadingSpace = curLine.match(/^(\s+)/)
      if (leadingSpace) {
        indent = leadingSpace[1]
      } else {
        const nm = curLine.match(/^(\d+\.\s+)/)
        const cm = curLine.match(/^(-\s*\[[ x]\]\s+)/)
        const bm = curLine.match(/^(-\s+)/)
        if (nm) indent = ' '.repeat(nm[1].length)
        else if (cm) indent = ' '.repeat(cm[1].length)
        else if (bm) indent = ' '.repeat(bm[1].length)
      }

      activeContent.value = before + '\n' + indent + activeContent.value.substring(pos)
      nextTick(() => {
        el.focus()
        el.setSelectionRange(pos + 1 + indent.length, pos + 1 + indent.length)
      })
      return
    }
    handleEnterKey(e)
  }
}

onMounted(() => {
  initForm()
  startAutoSave()
  nextTick(() => documentRef.value?.focusContent?.())
})

onUnmounted(() => {
  stopAutoSave()
  stopRecordingTimer()
  stopRecordingTracks()
})
</script>

<template>
  <MeetingWorkspace mode="edit" :assistant-open="assistantOpen" @update:assistant-open="assistantOpen = $event">
    <template #header>
      <MeetingWorkspaceHeader
        mode="edit"
        :save-status="autoSaveLabel"
        :can-export="Boolean(form.id)"
        @close="emit('close')"
        @complete="handleSubmit"
        @export="handleExport('docx')"
        @toggle-assistant="assistantOpen = !assistantOpen"
      />
    </template>

    <template #document>
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
        <template #toolbar>
          <MeetingEditorToolbar @command="runToolbarCommand" />
        </template>
      </MeetingDocument>
    </template>

    <template #assistant>
      <MeetingAssistant
        :is-recording="isRecording"
        :is-finishing-recording="isFinishingRecording"
        :is-transcribing="isTranscribing"
        :is-summarizing="isSummarizing"
        :recording-seconds="recordingSeconds"
        :recording-status="recordingStatus"
        :asr-status="asrStatus"
        :summary-status="summaryStatus"
        :has-content="Boolean(form.transcript.trim())"
        :can-export="Boolean(form.id)"
        :retry-kind="retryKind"
        @record-toggle="isRecording ? stopMeetingRecording() : startMeetingRecording()"
        @upload="chooseAudioFile"
        @summarize="handleSummarize"
        @export-markdown="handleExport('md')"
        @export-docx="handleExport('docx')"
        @retry="handleRetry"
      />
    </template>
  </MeetingWorkspace>

  <input
    ref="audioInputRef"
    type="file"
    accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,.mp3,.wav"
    class="hidden"
    @change="handleAudioSelected"
  />

</template>
