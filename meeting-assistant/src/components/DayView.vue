<script setup>
import { computed } from 'vue'
import { useDateUtils } from '@/composables/useDateUtils.js'

const props = defineProps({
  currentDate: Date,
  meetingsByDate: Object
})

const emit = defineEmits(['selectDate', 'selectMeeting'])

const dt = useDateUtils()
const dateStr = computed(() => dt.formatDate(props.currentDate))
const dayMeetings = computed(() => props.meetingsByDate[dateStr.value] || [])

const TOTAL = 24 * 60 * 60 / 60 // 1440 分钟 = 1440px

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
  <div class="card h-full flex flex-col overflow-hidden">
    <!-- 日期头 -->
    <div class="flex items-center gap-4 px-6 py-4 border-b border-slate-100 flex-shrink-0">
      <div
        class="inline-flex items-center justify-center w-10 h-10 rounded-full text-lg font-semibold"
        :class="dt.isToday(props.currentDate) ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700'"
      >{{ props.currentDate.getDate() }}</div>
      <div>
        <div class="text-sm font-medium text-slate-700">
          星期{{ dt.WEEKDAY_NAMES[props.currentDate.getDay() === 0 ? 6 : props.currentDate.getDay() - 1] }}
        </div>
        <div class="text-xs text-slate-400">{{ dateStr }}</div>
      </div>
      <div class="ml-auto text-xs text-slate-400">{{ dayMeetings.length }} 个会议</div>
    </div>

    <!-- 时间线 — 单一 relative 容器，所有元素绝对定位 -->
    <div class="flex-1 overflow-y-auto">
      <div class="relative mx-4" :style="{ height: TOTAL + 'px' }">

        <!-- 时间标签 -->
        <template v-for="h in 24" :key="'label-' + h">
          <div
            class="absolute left-0 w-12 text-right"
            :style="{ top: (h - 1) * 60 + 'px', height: '60px' }"
          >
            <span class="text-[10px] text-slate-400 relative -top-2">
              {{ String(h - 1).padStart(2, '0') }}:00
            </span>
          </div>
        </template>

        <!-- 时间槽（可点击） -->
        <template v-for="h in 24" :key="'slot-' + h">
          <div
            class="absolute left-14 right-0 border-b border-slate-50 hover:bg-slate-50/30 cursor-pointer transition-colors"
            :style="{ top: (h - 1) * 60 + 'px', height: '60px' }"
            @click="emit('selectDate', dateStr)"
          ></div>
        </template>

        <!-- 会议卡片 -->
        <div
          v-for="m in dayMeetings"
          :key="m.id"
          @click="emit('selectMeeting', m)"
          class="absolute left-16 right-2 p-3 rounded-lg cursor-pointer
                 bg-white border border-slate-200 shadow-sm
                 hover:shadow-md hover:border-primary-200
                 transition-all duration-150 z-10 overflow-hidden"
          :style="{ top: topPx(m) + 'px', height: heightPx(m) + 'px' }"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="text-sm font-medium text-slate-800 truncate">{{ m.title }}</div>
              <div class="text-xs text-primary-500 mt-0.5">{{ m.startTime }} - {{ m.endTime }}</div>
            </div>
            <div v-if="m.attendees?.length" class="flex -space-x-1 flex-shrink-0">
              <div
                v-for="(a, ai) in m.attendees.slice(0, 3)"
                :key="ai"
                class="w-5 h-5 rounded-full bg-primary-100 border border-white flex items-center justify-center text-[9px] text-primary-600 font-medium"
                :title="a"
              >{{ a.charAt(0) }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
