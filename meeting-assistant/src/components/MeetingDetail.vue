<script setup>
import { computed } from 'vue'
import { useDateUtils } from '@/composables/useDateUtils.js'

const props = defineProps({ meeting: Object })
const emit = defineEmits(['edit', 'delete', 'export', 'close'])
const dt = useDateUtils()

const dateDisplay = computed(() => {
  if (!props.meeting?.date) return ''
  return dt.formatDisplay(dt.parseDateStr(props.meeting.date))
})

// 内容区已改为直接展示原始文本，与编辑器样式一致

</script>

<template>
  <div v-if="meeting" class="flex flex-col h-full">
    <!-- 顶部栏 -->
    <header class="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white">
      <button @click="emit('close')" class="btn-ghost text-slate-500">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
      </button>
      <div class="flex items-center gap-2">
        <button @click="emit('edit', meeting)" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          编辑
        </button>
        <button @click="emit('export', meeting)" class="btn-secondary text-xs">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          导出
        </button>
        <button @click="emit('delete', meeting.id)" class="btn-ghost text-red-400 hover:text-red-600 hover:bg-red-50 text-xs">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </header>

    <!-- 标题区 -->
    <div class="flex-shrink-0 px-8 py-6 border-b border-slate-50">
      <h1 class="text-2xl font-bold text-slate-800 mb-3">{{ meeting.title }}</h1>
      <div class="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
        <span v-if="meeting.date" class="inline-flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
          {{ dateDisplay }}
        </span>
        <span v-if="meeting.startTime" class="inline-flex items-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          {{ meeting.startTime }}<template v-if="meeting.endTime"> - {{ meeting.endTime }}</template>
        </span>
        <span v-if="meeting.attendees?.length" class="inline-flex items-center gap-1.5 flex-wrap">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <span v-for="(name, i) in meeting.attendees" :key="i" class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">{{ name }}<span v-if="i < meeting.attendees.length - 1">,</span></span>
        </span>
      </div>
    </div>

    <!-- 内容区 — 与编辑器一致：等宽字体、保留原始格式 -->
    <div class="flex-1 overflow-y-auto">
      <pre
        v-if="meeting.content"
        class="w-full min-h-full px-8 py-6 text-sm text-slate-700 leading-relaxed
               bg-white border-none whitespace-pre-wrap font-mono"
      >{{ meeting.content }}</pre>
      <div v-else class="text-sm text-slate-300 italic py-8 text-center">
        暂无会议内容
      </div>
    </div>

    <!-- 底部信息 -->
    <div class="flex-shrink-0 px-8 py-3 border-t border-slate-50 text-center text-[10px] text-slate-300">
      创建于 {{ meeting.createdAt ? new Date(meeting.createdAt).toLocaleString('zh-CN') : '-' }}
      <template v-if="meeting.updatedAt && meeting.updatedAt !== meeting.createdAt">
        · 更新于 {{ new Date(meeting.updatedAt).toLocaleString('zh-CN') }}
      </template>
    </div>
  </div>
</template>
