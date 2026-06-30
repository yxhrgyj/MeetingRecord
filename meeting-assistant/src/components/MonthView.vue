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
  <div class="card h-full flex flex-col overflow-hidden">
    <!-- 星期头 -->
    <div class="grid grid-cols-7 border-b border-slate-100">
      <div
        v-for="(name, i) in dt.WEEKDAY_NAMES"
        :key="name"
        class="py-3 text-center text-xs font-medium tracking-wider"
        :class="i >= 5 ? 'text-slate-400' : 'text-slate-500'"
      >{{ name }}</div>
    </div>

    <!-- 日历格子 -->
    <div class="flex-1 grid grid-rows-6">
      <div
        v-for="(week, wi) in weeks"
        :key="wi"
        class="grid grid-cols-7 border-b border-slate-50 last:border-b-0"
      >
        <div
          v-for="(cell, ci) in week"
          :key="ci"
          @click="onCellClick(cell.date)"
          class="relative min-h-0 p-1.5 border-r border-slate-50 last:border-r-0
                 cursor-pointer transition-colors duration-100 hover:bg-slate-50/80
                 group overflow-hidden"
          :class="{
            'bg-primary-50/30': dt.isToday(cell.date),
            'opacity-40': !cell.isCurrentMonth
          }"
        >
          <!-- 日期数字 -->
          <div class="flex items-center justify-center mb-0.5">
            <span
              class="inline-flex items-center justify-center w-7 h-7 text-xs rounded-full transition-all"
              :class="{
                'bg-primary-600 text-white font-semibold shadow-sm': dt.isToday(cell.date),
                'text-slate-400': !cell.isCurrentMonth && !dt.isToday(cell.date),
                'text-slate-700': cell.isCurrentMonth && !dt.isToday(cell.date)
              }"
            >{{ cell.date.getDate() }}</span>
          </div>

          <!-- 会议条目 -->
          <div class="space-y-0.5">
            <div
              v-for="m in (props.meetingsByDate[dt.formatDate(cell.date)] || [])"
              :key="m.id"
              @click="onMeetingClick(m, $event)"
              class="text-[11px] leading-tight px-1.5 py-0.5 rounded truncate
                     bg-primary-50 text-primary-700 border border-primary-100/50
                     hover:bg-primary-100 hover:border-primary-200
                     transition-colors duration-100"
              :title="`${m.title} (${m.startTime}-${m.endTime})`"
            >
              <span class="text-[10px] text-primary-400 mr-0.5">{{ m.startTime }}</span>
              {{ m.title }}
            </div>
          </div>

          <!-- 悬浮加号 -->
          <div class="absolute top-1 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="w-4 h-4 flex items-center justify-center rounded-full bg-slate-200/60 text-slate-400 text-[10px]">
              +
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
