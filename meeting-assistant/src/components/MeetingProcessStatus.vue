<script setup>
defineProps({
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

<template>
  <div class="meeting-process" aria-label="会议处理进度">
    <ol class="relative grid grid-cols-3 before:absolute before:left-[16.66%] before:right-[16.66%] before:top-[5px] before:h-px before:bg-line">
      <li
        v-for="item in phases"
        :key="item.key"
        :data-phase="item.key"
        :aria-current="item.key === phase ? 'step' : undefined"
        class="relative z-10 flex flex-col items-center gap-1.5 text-[10px] text-muted"
        :class="item.key === phase && 'font-semibold text-primary-600'"
      >
        <span
          class="size-[11px] rounded-full border-2 border-line bg-surface"
          :class="item.key === phase && 'border-primary-500 bg-primary-500 ring-4 ring-primary-50'"
          aria-hidden="true"
        ></span>
        {{ item.label }}
      </li>
    </ol>

    <div
      role="status"
      aria-live="polite"
      :data-tone="tone"
      class="mt-3 flex min-h-8 items-center justify-between gap-3 text-[11px] text-secondary"
      :class="{
        'text-warning': tone === 'warning',
        'text-success': tone === 'success'
      }"
    >
      <span>{{ status }}</span>
      <button
        v-if="retryable"
        type="button"
        data-action="retry"
        class="focus-ring rounded-control px-2 py-1 font-medium text-primary-600 hover:bg-primary-50"
        @click="$emit('retry')"
      >
        重试
      </button>
    </div>
  </div>
</template>
