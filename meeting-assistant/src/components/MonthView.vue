<script setup>
import { computed } from 'vue'
import { useDateUtils } from '@/composables/useDateUtils.js'

const props = defineProps({
  currentDate: Date,
  meetingsByDate: Object
})

const emit = defineEmits(['selectDate', 'selectMeeting'])

const dt = useDateUtils()

const weeks = computed(() => {
  const y = props.currentDate.getFullYear()
  const m = props.currentDate.getMonth()
  return dt.getMonthGrid(y, m)
})

function onCellClick(date) {
  emit('selectDate', dt.formatDate(date))
}

function onMeetingClick(meeting, e) {
  e.stopPropagation()
  emit('selectMeeting', meeting)
}
</script>

<template>
  <div class="h-full min-h-[520px] flex flex-col overflow-hidden rounded-panel border border-line bg-surface">
    <!-- 星期头 -->
    <div class="grid grid-cols-7 border-b border-line bg-white">
      <div
        v-for="(name, i) in dt.WEEKDAY_NAMES"
        :key="name"
        class="py-2.5 text-right pr-3 text-[10px] font-medium"
        :class="i >= 5 ? 'text-muted' : 'text-secondary'"
      >{{ name }}</div>
    </div>

    <!-- 日历格子 -->
    <div class="flex-1 grid grid-rows-6">
      <div
        v-for="(week, wi) in weeks"
        :key="wi"
        class="grid grid-cols-7 border-b border-line last:border-b-0"
      >
        <div
          v-for="(cell, ci) in week"
          :key="ci"
          data-calendar-cell
          @click="onCellClick(cell.date)"
          class="relative min-h-0 p-2 border-r border-line last:border-r-0
                 cursor-pointer transition-colors duration-100 hover:bg-canvas/80
                 group overflow-hidden"
          :class="{
            'bg-primary-50/25': dt.isToday(cell.date),
            'bg-canvas/45 text-muted': !cell.isCurrentMonth
          }"
        >
          <!-- 日期数字 -->
          <div class="flex items-center justify-end mb-1">
            <span
              class="inline-flex items-center justify-center w-6 h-6 text-[11px] rounded-full transition-colors"
              :class="{
                'bg-recording text-white font-semibold': dt.isToday(cell.date),
                'text-muted': !cell.isCurrentMonth && !dt.isToday(cell.date),
                'text-ink': cell.isCurrentMonth && !dt.isToday(cell.date)
              }"
            >{{ cell.date.getDate() }}</span>
          </div>

          <!-- 会议条目 -->
          <div class="space-y-0.5">
            <div
              v-for="m in (props.meetingsByDate[dt.formatDate(cell.date)] || [])"
              :key="m.id"
              :data-meeting-id="m.id"
              @click="onMeetingClick(m, $event)"
              class="text-[10px] leading-tight px-1.5 py-1 rounded-control truncate
                     bg-primary-50 text-primary-700
                     hover:bg-primary-100
                     transition-colors duration-100"
              :title="`${m.title} (${m.startTime}-${m.endTime})`"
            >
              <span v-if="m.startTime" class="text-[9px] text-primary-500 mr-0.5">{{ m.startTime }}</span>
              {{ m.title }}
            </div>
          </div>

          <!-- 悬浮加号 -->
          <div class="absolute top-1 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="w-4 h-4 flex items-center justify-center rounded-full bg-line/70 text-muted text-[10px]">
              +
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
