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
  modelLabel: { type: String, default: 'qwen3.5:9b' },
  recordingSegments: { type: Array, default: () => [] },
  pendingRecordingCount: { type: Number, default: 0 },
  persistedRecordingJobs: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'record-toggle',
  'upload',
  'summarize',
  'export-markdown',
  'export-docx',
  'retry',
  'retry-segment',
  'retry-persisted'
])

const busy = computed(() => (
  props.isFinishingRecording || props.isTranscribing || props.isSummarizing
))

const hasIncompleteSegments = computed(() => props.recordingSegments.some(segment => (
  ['queued', 'processing', 'failed'].includes(segment?.status)
)))

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
const recordDisabled = computed(() => (
  props.isFinishingRecording || props.isTranscribing || props.isSummarizing
))
const uploadDisabled = computed(() => props.isRecording || props.isFinishingRecording || props.isSummarizing)
const summarizeDisabled = computed(() => (
  !props.hasContent || props.isRecording || busy.value || hasIncompleteSegments.value
))

const recordingLabel = computed(() => {
  if (props.isFinishingRecording) return '正在整理录音…'
  return props.isRecording
    ? '结束会议录音（当前段）'
    : (props.recordingSegments.length ? '开始下一段录音' : '开始会议录音')
})

function segmentStatusLabel(status) {
  return {
    queued: '排队中',
    processing: '转写中',
    completed: '已完成',
    failed: '失败'
  }[status] || '未开始'
}

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

      <div v-if="recordingSegments.length" class="mt-3 space-y-1.5" data-region="recording-segments">
        <div class="flex items-center justify-between text-[10px] text-muted">
          <span>录音段处理</span>
          <span>{{ pendingRecordingCount ? `${pendingRecordingCount} 段处理中` : '可生成总纪要' }}</span>
        </div>
        <div
          v-for="segment in recordingSegments"
          :key="segment.id || segment.index"
          class="flex min-h-7 items-center gap-2 rounded-control border border-line bg-canvas px-2 text-[10px]"
        >
          <span class="font-medium text-secondary">第 {{ segment.index + 1 }} 段</span>
          <span class="text-muted">{{ segmentStatusLabel(segment.status) }}</span>
          <button
            v-if="segment.status === 'failed'"
            type="button"
            data-action="retry-segment"
            class="ml-auto font-medium text-primary-600 hover:text-primary-800"
            @click="$emit('retry-segment', segment.index)"
          >
            重试
          </button>
        </div>
      </div>

      <div v-if="persistedRecordingJobs.length" class="mt-3 space-y-1.5" data-region="persisted-recordings">
        <div class="flex items-center justify-between text-[10px] text-muted">
          <span>已保存的录音任务</span>
          <span>{{ persistedRecordingJobs.length }} 条</span>
        </div>
        <div
          v-for="job in persistedRecordingJobs"
          :key="job.id"
          class="flex min-h-8 items-center gap-2 rounded-control border border-line bg-canvas px-2 text-[10px]"
        >
          <span class="min-w-0 flex-1 truncate text-secondary">{{ job.id }}</span>
          <span class="text-muted">{{ segmentStatusLabel(job.status) }}</span>
          <button
            v-if="job.status === 'failed'"
            type="button"
            data-action="retry-persisted"
            class="font-medium text-primary-600 hover:text-primary-800"
            @click="$emit('retry-persisted', job.id)"
          >
            重新转写
          </button>
        </div>
      </div>

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
