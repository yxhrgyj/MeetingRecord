<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  FileDown,
  Plus,
  Settings
} from '@lucide/vue'

defineProps({
  view: { type: String, required: true },
  title: { type: String, required: true }
})

const emit = defineEmits([
  'update:view',
  'navigate',
  'today',
  'create',
  'model-settings',
  'export-month'
])

const overflowOpen = ref(false)
const views = [
  { key: 'month', label: '月' },
  { key: 'week', label: '周' },
  { key: 'day', label: '日' }
]

function runOverflowAction(eventName) {
  overflowOpen.value = false
  emit(eventName)
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') overflowOpen.value = false
}

onMounted(() => document.addEventListener('keydown', handleDocumentKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleDocumentKeydown))
</script>

<template>
  <header class="shrink-0 border-b border-black/[0.08] bg-white/90 backdrop-blur-xl">
    <div class="mx-auto max-w-[1600px] px-4 sm:px-6">
      <div class="flex h-[58px] items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-2.5">
          <span class="flex size-7 shrink-0 items-center justify-center rounded-panel bg-ink text-white" aria-hidden="true">
            <CalendarDays :size="15" :stroke-width="1.8" />
          </span>
          <span class="truncate text-[13px] font-semibold text-ink">会议助理</span>
        </div>

        <div class="flex items-center gap-2">
          <div class="flex rounded-panel bg-black/[0.055] p-[3px]" aria-label="日历视图">
            <button
              v-for="item in views"
              :key="item.key"
              type="button"
              :data-view="item.key"
              :aria-pressed="view === item.key"
              class="focus-ring min-w-9 rounded-control px-2.5 py-1 text-[11px] font-medium transition-colors"
              :class="view === item.key ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'"
              @click="$emit('update:view', item.key)"
            >
              {{ item.label }}
            </button>
          </div>

          <div class="relative">
            <button
              type="button"
              class="icon-button"
              aria-label="更多操作"
              :aria-expanded="overflowOpen"
              aria-haspopup="menu"
              @click="overflowOpen = !overflowOpen"
            >
              <Ellipsis :size="17" />
            </button>

            <div
              v-if="overflowOpen"
              role="menu"
              class="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-panel border border-line bg-surface p-1.5 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                data-action="model-settings"
                class="focus-ring flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left text-xs text-secondary hover:bg-canvas hover:text-ink"
                @click="runOverflowAction('model-settings')"
              >
                <Settings :size="15" />
                模型设置
              </button>
              <button
                type="button"
                role="menuitem"
                data-action="export-month"
                class="focus-ring flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left text-xs text-secondary hover:bg-canvas hover:text-ink"
                @click="runOverflowAction('export-month')"
              >
                <FileDown :size="15" />
                导出本月
              </button>
            </div>
          </div>

          <button type="button" data-action="create" class="btn-primary h-8 px-3 text-xs" @click="$emit('create')">
            <Plus :size="15" />
            <span class="hidden sm:inline">新建会议</span>
          </button>
        </div>
      </div>

      <div class="flex min-h-[54px] items-end justify-between gap-4 pb-3">
        <h1 class="min-w-0 truncate text-[26px] font-semibold leading-none text-ink">{{ title }}</h1>
        <div class="flex shrink-0 items-center gap-1">
          <button type="button" data-action="today" class="command-button h-[30px] min-h-0 px-2.5" @click="$emit('today')">
            今天
          </button>
          <button type="button" class="icon-button" aria-label="上一时间段" @click="$emit('navigate', -1)">
            <ChevronLeft :size="17" />
          </button>
          <button type="button" class="icon-button" aria-label="下一时间段" @click="$emit('navigate', 1)">
            <ChevronRight :size="17" />
          </button>
        </div>
      </div>
    </div>
  </header>
</template>
