<script setup>
import { computed } from 'vue'
import { useDateUtils } from '@/composables/useDateUtils.js'

const props = defineProps({
  currentDate: Date,
  meetingsByDate: Object
})

const emit = defineEmits(['selectDate', 'selectMeeting'])
const dt = useDateUtils()
const weekDays = computed(() => dt.getWeekDays(props.currentDate))

// 表头和内容区共用同一套列宽：56px（时间列） + 7 等分
const GRID_STYLE = 'grid-template-columns: 56px repeat(7, 1fr)'

function topPx(meeting) {
  const [sh, sm] = (meeting.startTime || '09:00').split(':').map(Number)
  return sh * 60 + sm
}
function heightPx(meeting) {
  const [sh, sm] = (meeting.startTime || '09:00').split(':').map(Number)
  const [eh, em] = (meeting.endTime || '10:00').split(':').map(Number)
  return Math.max(eh * 60 + em - (sh * 60 + sm), 30)
}
</script>

<template>
  <div class="h-full flex flex-col overflow-hidden rounded-panel border border-line bg-surface">
    <!-- 星期头 -->
    <div class="grid border-b border-line flex-shrink-0" :style="GRID_STYLE">
      <div class="py-3"></div>
      <div v-for="(day, i) in weekDays" :key="i" class="py-3 text-center border-l border-line">
        <div class="text-[10px] text-muted mb-0.5">{{ dt.WEEKDAY_NAMES[i] }}</div>
        <div
          class="inline-flex items-center justify-center w-8 h-8 text-sm rounded-full"
          :class="dt.isToday(day) ? 'bg-recording text-white font-semibold' : 'text-ink'"
        >{{ day.getDate() }}</div>
      </div>
    </div>

    <!-- 内容区：同一个 Grid，绝对定位叠加时间标签和会议卡片 -->
    <div class="flex-1 overflow-y-auto">
      <div
        class="grid relative"
        :style="GRID_STYLE + '; height: 1440px; min-height: 1440px'"
      >
        <!-- 时间标签列 -->
        <div class="relative border-r border-line">
          <div
            v-for="h in 24" :key="'label-' + h"
            class="absolute right-2 w-full text-right"
            :style="{ top: (h - 1) * 60 + 'px', height: '60px' }"
          >
            <span class="text-[10px] text-muted relative -top-2">
              {{ String(h - 1).padStart(2, '0') }}:00
            </span>
          </div>
        </div>

        <!-- 7 天列 -->
        <div
          v-for="(day, di) in weekDays"
          :key="'col-' + di"
          class="relative border-l border-line"
        >
          <!-- 时间槽（可点击） -->
          <div
            v-for="h in 24" :key="'slot-' + h"
            :data-time-slot="String(h - 1).padStart(2, '0') + ':00'"
            class="absolute left-0 right-0 border-b border-line/60 hover:bg-canvas/60 cursor-pointer transition-colors"
            :style="{ top: (h - 1) * 60 + 'px', height: '60px' }"
            @click="emit('selectDate', dt.formatDate(day))"
          ></div>

          <!-- 会议卡片 -->
          <div
            v-for="m in (props.meetingsByDate[dt.formatDate(day)] || [])"
            :key="m.id"
            :data-meeting-id="m.id"
            @click="emit('selectMeeting', m)"
            class="absolute left-1 right-1 px-2 py-1 rounded-control text-[10px] leading-tight
                   bg-primary-50 text-primary-700 border border-primary-100
                   hover:bg-primary-100 cursor-pointer overflow-hidden
                   transition-colors duration-100 z-10"
            :style="{ top: topPx(m) + 'px', height: heightPx(m) + 'px', minHeight: '24px' }"
          >
            <div class="font-medium truncate">{{ m.title }}</div>
            <div class="text-primary-500">{{ m.startTime }}-{{ m.endTime }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
