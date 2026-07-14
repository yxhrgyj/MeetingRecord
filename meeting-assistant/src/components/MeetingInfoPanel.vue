<script setup>
import {
  CalendarClock,
  CheckCircle2,
  FileDown,
  FileText,
  Trash2,
  Users
} from '@lucide/vue'

defineProps({
  meeting: { type: Object, required: true }
})

defineEmits(['export-markdown', 'export-docx', 'delete'])

function formatTimestamp(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="pb-2">
    <div class="flex h-9 items-center justify-between pr-8 min-[1100px]:pr-0">
      <h2 class="text-[13px] font-semibold text-ink">会议信息</h2>
      <span class="flex items-center gap-1 text-[10px] font-medium text-emerald-700">
        <CheckCircle2 :size="12" />
        已整理
      </span>
    </div>

    <section class="mt-4 border-t border-line py-[18px]">
      <h3 class="text-xs font-semibold text-ink">基本信息</h3>
      <div class="mt-3 space-y-4 text-[11px] leading-5 text-secondary">
        <div class="flex items-start gap-2.5">
          <Users :size="15" class="mt-0.5 shrink-0 text-muted" />
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="(name, index) in meeting.attendees || []"
              :key="`${name}-${index}`"
              class="rounded-full bg-canvas px-2 py-0.5 text-[10px] text-secondary"
            >
              {{ name }}
            </span>
            <span v-if="!meeting.attendees?.length" class="text-muted">未填写参会人</span>
          </div>
        </div>

        <div class="flex items-start gap-2.5">
          <CalendarClock :size="15" class="mt-0.5 shrink-0 text-muted" />
          <div>
            <div>创建于 {{ formatTimestamp(meeting.createdAt) }}</div>
            <div v-if="meeting.updatedAt">更新于 {{ formatTimestamp(meeting.updatedAt) }}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="border-t border-line py-[18px]">
      <h3 class="text-xs font-semibold text-ink">导出文档</h3>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" data-action="export-markdown" class="command-button h-9" @click="$emit('export-markdown')">
          <FileText :size="13" />
          Markdown
        </button>
        <button type="button" data-action="export-docx" class="command-button h-9" @click="$emit('export-docx')">
          <FileDown :size="13" />
          Word
        </button>
      </div>
    </section>

    <section class="border-t border-line py-[18px]">
      <h3 class="text-xs font-semibold text-ink">管理</h3>
      <button
        type="button"
        data-action="delete"
        class="focus-ring mt-2 inline-flex h-9 w-full items-center gap-2 rounded-control px-2 text-left text-[11px] text-red-600 hover:bg-red-50"
        @click="$emit('delete', meeting.id)"
      >
        <Trash2 :size="14" />
        删除会议记录
      </button>
    </section>
  </div>
</template>
