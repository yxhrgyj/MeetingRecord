<script setup>
import { reactive, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useApi } from '@/composables/useApi.js'
import { formatTranscriptForEditor, useAsr } from '@/composables/useAsr.js'
import { useLocalRecording } from '@/composables/useLocalRecording.js'
import { mergeSummaryIntoContent, useSummarizer } from '@/composables/useSummarizer.js'
import { useDateUtils } from '@/composables/useDateUtils.js'

const props = defineProps({ initialData: Object })
const emit = defineEmits(['save', 'close'])

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
  content: ''
})

const attendeeInput = ref('')
const contentRef = ref(null)
const audioInputRef = ref(null)
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

function initForm() {
  if (props.initialData) {
    form.id = props.initialData.id || ''
    form.title = props.initialData.title || ''
    form.date = props.initialData.date || dt.formatDate(new Date())
    form.startTime = props.initialData.startTime || ''
    form.endTime = props.initialData.endTime || ''
    form.attendees = [...(props.initialData.attendees || [])]
    form.content = props.initialData.content || ''
  }
}

// ===== 参会人标签 =====
function addAttendee() {
  const name = attendeeInput.value.trim()
  if (name && !form.attendees.includes(name)) {
    form.attendees.push(name)
    attendeeInput.value = ''
  }
}
function removeAttendee(i) { form.attendees.splice(i, 1) }
function onAttendeeKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addAttendee()
  }
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
  const el = contentRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = form.content.substring(start, end)
  const replacement = before + selected + after
  form.content = form.content.substring(0, start) + replacement + form.content.substring(end)
  nextTick(() => {
    el.focus()
    const pos = start + before.length + selected.length + after.length
    el.setSelectionRange(pos, pos)
  })
}

function replaceAtCursor(text) {
  const el = contentRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  form.content = form.content.substring(0, start) + text + form.content.substring(end)
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
    const prefix = form.content.trim() ? '\n\n' : ''
    replaceAtCursor(`${prefix}${transcript}`)
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
  let nextContent = form.content.trimEnd()
  if (transcript) {
    nextContent = nextContent ? `${nextContent}\n\n${transcript}` : transcript
  }
  if (result.summary) {
    nextContent = mergeSummaryIntoContent(nextContent, result.summary)
  }
  form.content = nextContent
  nextTick(() => {
    contentRef.value?.focus()
    const end = form.content.length
    contentRef.value?.setSelectionRange(end, end)
  })
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
  if (!form.content.trim()) {
    summaryStatus.value = '没有可整理的内容'
    setTimeout(() => {
      if (summaryStatus.value === '没有可整理的内容') summaryStatus.value = ''
    }, 3000)
    return
  }

  isSummarizing.value = true
  summaryStatus.value = '纪要整理中...'
  try {
    const result = await summarizer.summarizeContent(form.content)
    form.content = mergeSummaryIntoContent(form.content, result.summary)
    summaryStatus.value = '纪要已生成'
    nextTick(() => {
      contentRef.value?.focus()
      const end = form.content.length
      contentRef.value?.setSelectionRange(end, end)
    })
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
  if (!form.title.trim() && !form.content.trim()) return

  const prevLabel = autoSaveLabel.value
  autoSaveLabel.value = '保存中…'
  try {
    const payload = { ...form, attendees: [...form.attendees] }
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
  emit('save', { ...form, attendees: [...form.attendees] })
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
  const el = contentRef.value
  if (!el) return

  const pos = el.selectionStart
  const beforeCursor = form.content.substring(0, pos)
  const afterCursor = form.content.substring(pos)
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
    form.content = beforeCursor + '\n' + next + '. ' + renumbered
    nextTick(() => {
      el.focus()
      // pos + 1(\n) + next.length + 2(". ") = 新编号行末尾
      el.setSelectionRange(pos + 1 + String(next).length + 2, pos + 1 + String(next).length + 2)
    })
    return
  }
  if (emptyNumMatch) {
    e.preventDefault()
    form.content = beforeCursor.substring(0, lastNewline + 1) + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(lastNewline + 1, lastNewline + 1)
    })
    return
  }
  if (chkMatch) {
    e.preventDefault()
    form.content = beforeCursor + '\n- [ ] ' + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(pos + 7, pos + 7)
    })
    return
  }
  if (emptyChkMatch) {
    e.preventDefault()
    form.content = beforeCursor.substring(0, lastNewline + 1) + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(lastNewline + 1, lastNewline + 1)
    })
    return
  }
  if (bulMatch) {
    e.preventDefault()
    form.content = beforeCursor + '\n- ' + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(pos + 3, pos + 3)
    })
    return
  }
  if (emptyBulMatch) {
    e.preventDefault()
    form.content = beforeCursor.substring(0, lastNewline + 1) + afterCursor
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
    form.content = beforeCursor + '\n' + ancestor.next + '. ' + renumbered
    nextTick(() => {
      el.focus()
      // pos + 1(\n) + next.length + 2(". ") = 新编号行末尾
      el.setSelectionRange(pos + 1 + String(ancestor.next).length + 2, pos + 1 + String(ancestor.next).length + 2)
    })
  } else if (ancestor.type === 'checkbox') {
    form.content = beforeCursor + '\n- [ ] ' + afterCursor
    nextTick(() => { el.focus(); el.setSelectionRange(pos + 7, pos + 7) })
  } else if (ancestor.type === 'bullet') {
    form.content = beforeCursor + '\n- ' + afterCursor
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
      const el = contentRef.value
      if (!el) return
      const pos = el.selectionStart
      const before = form.content.substring(0, pos)
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

      form.content = before + '\n' + indent + form.content.substring(pos)
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
  nextTick(() => contentRef.value?.focus())
})

onUnmounted(() => {
  stopAutoSave()
  stopRecordingTimer()
  stopRecordingTracks()
})
</script>

<template>
  <!-- 顶部栏 -->
  <header class="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white">
    <div class="flex items-center gap-4 min-w-0">
      <button @click="emit('close')" class="btn-ghost text-slate-500 flex-shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
      </button>
      <input
        v-model="form.title"
        type="text"
        class="text-lg font-semibold text-slate-800 bg-transparent border-none outline-none placeholder-slate-300 flex-1 min-w-0"
        placeholder="输入会议标题..."
      />
    </div>
    <div class="flex items-center gap-3 flex-shrink-0">
      <span
        v-if="autoSaveLabel"
        class="text-[11px] transition-all duration-300"
        :class="autoSaveLabel.includes('失败') ? 'text-red-400' : 'text-emerald-500'"
      >{{ autoSaveLabel }}</span>
      <button @click="handleSubmit" class="btn-primary text-sm">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        保存并返回
      </button>
    </div>
  </header>

  <!-- 元信息栏 -->
  <div class="flex-shrink-0 px-6 py-3 border-b border-slate-50 bg-slate-50/50">
    <div class="flex items-center gap-4 flex-wrap">
      <div class="flex items-center gap-1.5 text-sm text-slate-500">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <input v-model="form.date" type="date" class="bg-transparent border-none outline-none text-slate-600 text-sm w-32" />
      </div>
      <div class="flex items-center gap-1 text-sm text-slate-500">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <input v-model="form.startTime" type="time" class="bg-transparent border-none outline-none text-slate-600 text-sm w-24" placeholder="开始" />
        <button @click="recordStartTime" type="button" class="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-white hover:text-primary-600 hover:border-primary-300 transition-colors" title="记录当前时间为开始时间">开始</button>
        <span class="text-slate-300">-</span>
        <input v-model="form.endTime" type="time" class="bg-transparent border-none outline-none text-slate-600 text-sm w-24" placeholder="结束" />
        <button @click="recordEndTime" type="button" class="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-white hover:text-primary-600 hover:border-primary-300 transition-colors" title="记录当前时间为结束时间">结束</button>
      </div>
      <div class="h-4 w-px bg-slate-200"></div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <span
          v-for="(name, i) in form.attendees" :key="i"
          class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-white border border-slate-200 text-slate-600"
        >{{ name }}<button @click="removeAttendee(i)" class="text-slate-300 hover:text-red-400">&times;</button></span>
        <input
          v-model="attendeeInput"
          @keydown="onAttendeeKeydown" @blur="addAttendee"
          type="text"
          class="bg-transparent border-none outline-none text-sm text-slate-400 placeholder-slate-300 w-24"
          placeholder="+ 参会人"
        />
      </div>
    </div>
  </div>

  <!-- 快捷工具栏 -->
  <div class="flex-shrink-0 flex items-center gap-0.5 px-6 py-2 border-b border-slate-50 bg-white">
    <button @click="insertHeading" class="btn-ghost text-xs px-2 py-1 font-mono" title="二级标题">H2</button>
    <button @click="insertSubheading" class="btn-ghost text-xs px-2 py-1 font-mono" title="三级标题">H3</button>
    <div class="w-px h-4 bg-slate-200 mx-1"></div>
    <button @click="insertBold" class="btn-ghost text-xs px-2 py-1 font-bold" title="加粗">B</button>
    <button @click="insertItalic" class="btn-ghost text-xs px-2 py-1 italic" title="斜体">I</button>
    <div class="w-px h-4 bg-slate-200 mx-1"></div>
    <button @click="insertNumbered" class="btn-ghost text-xs px-2 py-1" title="有序列表">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h12M7 12h12M7 16h12M4 8h.01M4 12h.01M4 16h.01"/></svg>
    </button>
    <button @click="insertBullet" class="btn-ghost text-xs px-2 py-1" title="无序列表">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/></svg>
    </button>
    <button @click="insertCheckbox" class="btn-ghost text-xs px-2 py-1" title="待办勾选框">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
    </button>
    <button @click="insertQuote" class="btn-ghost text-xs px-2 py-1" title="引用">❝</button>
    <button @click="insertCode" class="btn-ghost text-xs px-2 py-1 font-mono" title="代码块">&lt;/&gt;</button>
    <button @click="insertDivider" class="btn-ghost text-xs px-2 py-1" title="分隔线">—</button>
    <div class="w-px h-4 bg-slate-200 mx-1"></div>
    <button @click="insertTemplate" class="btn-ghost text-xs px-2 py-1 text-primary-500 font-medium" title="插入会议模板">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      会议模板
    </button>
    <input
      ref="audioInputRef"
      type="file"
      accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,.mp3,.wav"
      class="hidden"
      @change="handleAudioSelected"
    />
    <div class="w-px h-4 bg-slate-200 mx-1"></div>
    <button
      @click="isRecording ? stopMeetingRecording() : startMeetingRecording()"
      :disabled="isFinishingRecording || isTranscribing || isSummarizing"
      class="btn-ghost text-xs px-2 py-1 font-medium"
      :class="isRecording ? 'text-red-500' : (isFinishingRecording || isTranscribing || isSummarizing ? 'opacity-50 cursor-not-allowed' : 'text-primary-500')"
      title="本机会议录音，结束后自动转写并整理纪要"
    >
      <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/></svg>
      {{ isRecording ? '结束录音' : (isFinishingRecording ? '整理录音...' : '会议录音') }}
    </button>
    <span v-if="recordingStatus" class="text-[10px] text-slate-400">{{ recordingStatus }}</span>
    <div class="w-px h-4 bg-slate-200 mx-1"></div>
    <button
      @click="chooseAudioFile"
      :disabled="isTranscribing"
      class="btn-ghost text-xs px-2 py-1 font-medium"
      :class="isTranscribing ? 'opacity-50 cursor-not-allowed' : 'text-primary-500'"
      title="上传音频转写"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
      {{ isTranscribing ? 'ASR...' : 'ASR' }}
    </button>
    <span v-if="asrStatus" class="text-[10px] text-slate-400">{{ asrStatus }}</span>
    <div class="w-px h-4 bg-slate-200 mx-1"></div>
    <button
      @click="handleSummarize"
      :disabled="isSummarizing || !form.content.trim()"
      class="btn-ghost text-xs px-2 py-1 font-medium"
      :class="isSummarizing || !form.content.trim() ? 'opacity-50 cursor-not-allowed' : 'text-primary-500'"
      title="整理会议纪要"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m5-11v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h8l5 5z"/></svg>
      {{ isSummarizing ? '整理中...' : '整理纪要' }}
    </button>
    <span v-if="summaryStatus" class="text-[10px] text-slate-400">{{ summaryStatus }}</span>
    <div class="ml-auto flex items-center gap-3 text-[10px] text-slate-300">
      <span>每分钟自动保存</span>
      <span>Enter 续号 · Shift+Enter 换行 · Ctrl+S 保存</span>
    </div>
  </div>

  <!-- 自由书写区 -->
  <div class="flex-1 overflow-hidden">
    <textarea
      ref="contentRef"
      v-model="form.content"
      @keydown="onKeydown"
      class="w-full h-full px-8 py-6 text-sm text-slate-700 leading-relaxed
             bg-white border-none outline-none resize-none
             placeholder-slate-300 font-mono"
      placeholder="在此自由书写会议纪要…

使用上方工具栏插入格式，或点击「会议模板」一键生成结构。

每分钟自动保存，无需担心内容丢失。"
    ></textarea>
  </div>
</template>
