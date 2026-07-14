<script setup>
import { computed } from 'vue'
import {
  FileDown,
  FileText,
  Mic,
  Sparkles,
  Upload
} from '@lucide/vue'
import MeetingProcessStatus from './MeetingProcessStatus.vue'

const props = defineProps({
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

const emit = defineEmits([
  'record-toggle',
  'upload',
  'summarize',
  'export-markdown',
  'export-docx',
  'retry'
])

const busy = computed(() => (
  props.isFinishingRecording || props.isTranscribing || props.isSummarizing
))

const processPhase = computed(() => {
  if (props.isFinishingRecording || props.isTranscribing) return 'transcribe'
  if (props.isSummarizing || props.summaryStatus) return 'organize'
  return 'record'
})

const processStatus = computed(() => (
  props.recordingStatus || props.asrStatus || props.summaryStatus || ''
))

const processTone = computed(() => {
  if (/失败|不可用|异常|错误/.test(processStatus.value)) return 'warning'
  if (/已|完成|生成/.test(processStatus.value)) return 'success'
  return 'neutral'
})

const retryable = computed(() => ['record', 'summarize'].includes(props.retryKind))
const recordDisabled = computed(() => busy.value && !props.isRecording)
const uploadDisabled = computed(() => props.isRecording || busy.value)
const summarizeDisabled = computed(() => !props.hasContent || props.isRecording || busy.value)

const recordingLabel = computed(() => {
  if (props.isFinishingRecording) return '正在整理录音…'
  return props.isRecording ? '结束会议录音' : '开始会议录音'
})

function formatDuration(seconds) {
  const safe = Math.max(0, Number(seconds) || 0)
  const minutes = Math.floor(safe / 60)
  const remaining = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

function retry() {
  if (retryable.value) emit('retry', props.retryKind)
}
</script>

<template>
  <div class="pb-2">
    <div class="flex h-9 items-center justify-between pr-8 min-[1100px]:pr-0">
      <h2 class="text-[13px] font-semibold text-ink">会议助手</h2>
      <span class="text-[10px] text-muted">{{ modelLabel }}</span>
    </div>

    <MeetingProcessStatus
      class="mt-3"
      :phase="processPhase"
      :status="processStatus"
      :tone="processTone"
      :retryable="retryable"
      @retry="retry"
    />

    <section class="mt-2 border-t border-line py-[18px]">
      <h3 class="text-xs font-semibold text-ink">实时记录</h3>
      <p class="mt-1 text-[10px] leading-4 text-muted">录音结束后自动转写，并将结果追加到会议正文。</p>

      <button
        type="button"
        data-action="record-toggle"
        class="focus-ring mt-3 flex h-11 w-full items-center gap-2.5 rounded-panel border px-3 text-[11px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45"
        :class="isRecording
          ? 'border-recording/30 bg-red-50 text-red-700'
          : 'border-line bg-surface text-secondary hover:bg-canvas hover:text-ink'"
        :disabled="recordDisabled"
        @click="$emit('record-toggle')"
      >
        <span class="flex size-5 items-center justify-center rounded-full" :class="isRecording ? 'bg-recording/10 text-recording' : 'bg-canvas text-muted'">
          <Mic :size="13" />
        </span>
        <span>{{ recordingLabel }}</span>
        <span v-if="isRecording" class="ml-auto font-mono text-[10px] text-recording">{{ formatDuration(recordingSeconds) }}</span>
      </button>

      <button
        type="button"
        data-action="upload"
        class="command-button mt-2 h-10 w-full justify-between"
        :disabled="uploadDisabled"
        @click="$emit('upload')"
      >
        <span>上传已有音频</span>
        <Upload :size="14" class="text-muted" />
      </button>
    </section>

    <section class="border-t border-line py-[18px]">
      <h3 class="text-xs font-semibold text-ink">AI 会议纪要</h3>
      <p class="mt-1 text-[10px] leading-4 text-muted">从当前正文提取议题、结论、决定和行动项。</p>
      <button
        type="button"
        data-action="summarize"
        class="focus-ring mt-3 flex h-10 w-full items-center justify-between rounded-panel border border-primary-200 bg-primary-50 px-3 text-[11px] font-semibold text-primary-700 hover:bg-primary-100 disabled:pointer-events-none disabled:opacity-45"
        :disabled="summarizeDisabled"
        @click="$emit('summarize')"
      >
        <span>{{ isSummarizing ? '正在整理纪要…' : '整理为会议纪要' }}</span>
        <Sparkles :size="14" />
      </button>
    </section>

    <section class="border-t border-line py-[18px]">
      <h3 class="text-xs font-semibold text-ink">导出文档</h3>
      <p class="mt-1 text-[10px] leading-4 text-muted">导出当前已经保存的会议内容。</p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          data-action="export-markdown"
          class="command-button h-9"
          :disabled="!canExport"
          @click="$emit('export-markdown')"
        >
          <FileText :size="13" />
          Markdown
        </button>
        <button
          type="button"
          data-action="export-docx"
          class="command-button h-9"
          :disabled="!canExport"
          @click="$emit('export-docx')"
        >
          <FileDown :size="13" />
          Word
        </button>
      </div>
    </section>
  </div>
</template>
