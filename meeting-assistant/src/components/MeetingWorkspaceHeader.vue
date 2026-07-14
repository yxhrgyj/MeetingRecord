<script setup>
import { computed } from 'vue'
import {
  ArrowLeft,
  Check,
  Download,
  Ellipsis,
  PanelRightOpen,
  Pencil
} from '@lucide/vue'

const props = defineProps({
  mode: { type: String, required: true },
  saveStatus: { type: String, default: '' },
  canExport: Boolean
})

const emit = defineEmits([
  'close',
  'export',
  'complete',
  'edit',
  'toggle-assistant',
  'more'
])

const primaryLabel = computed(() => props.mode === 'read' ? '编辑' : '完成')
const contextLabel = computed(() => props.mode === 'read' ? '会议纪要' : '新建会议')
const saveTone = computed(() => props.saveStatus.includes('失败') ? 'warning' : 'success')

function runPrimaryAction() {
  emit(props.mode === 'read' ? 'edit' : 'complete')
}
</script>

<template>
  <header class="grid h-[58px] shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-black/[0.08] bg-white/90 px-3 backdrop-blur-xl sm:px-[18px]">
    <div class="flex min-w-0 items-center gap-2">
      <button type="button" data-action="close" class="icon-button" aria-label="返回日历" @click="$emit('close')">
        <ArrowLeft :size="18" />
      </button>
      <span class="hidden text-xs font-semibold text-ink sm:inline">会议助理</span>
      <span v-if="saveStatus" class="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-muted">
        <span class="size-1.5 shrink-0 rounded-full" :class="saveTone === 'warning' ? 'bg-warning' : 'bg-success'"></span>
        {{ saveStatus }}
      </span>
    </div>

    <div class="text-[11px] text-secondary">{{ contextLabel }}</div>

    <div class="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
      <button
        type="button"
        data-action="toggle-assistant"
        class="icon-button min-[1100px]:hidden"
        aria-label="打开会议助手"
        @click="$emit('toggle-assistant')"
      >
        <PanelRightOpen :size="17" />
      </button>
      <button type="button" class="icon-button" aria-label="更多操作" @click="$emit('more')">
        <Ellipsis :size="17" />
      </button>
      <button
        type="button"
        data-action="export"
        class="command-button hidden h-8 sm:inline-flex"
        :disabled="!canExport"
        @click="$emit('export')"
      >
        <Download :size="14" />
        导出
      </button>
      <button type="button" data-action="primary" class="btn-primary h-8 px-3 text-xs" @click="runPrimaryAction">
        <Pencil v-if="mode === 'read'" :size="14" />
        <Check v-else :size="14" />
        {{ primaryLabel }}
      </button>
    </div>
  </header>
</template>
