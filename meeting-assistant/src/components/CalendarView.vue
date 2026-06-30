<script setup>
import { computed } from 'vue'
import { useDateUtils } from '@/composables/useDateUtils.js'
import MonthView from './MonthView.vue'
import WeekView from './WeekView.vue'
import DayView from './DayView.vue'

const props = defineProps({
  currentDate: Date,
  view: String,
  meetings: Array,
  loading: Boolean
})

const emit = defineEmits(['selectDate', 'selectMeeting'])

const dt = useDateUtils()

const meetingsByDate = computed(() => {
  const map = {}
  for (const m of props.meetings) {
    if (!map[m.date]) map[m.date] = []
    map[m.date].push(m)
  }
  return map
})
</script>

<template>
  <div class="h-full">
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="flex items-center gap-2 text-sm text-slate-400">
        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        加载中...
      </div>
    </div>

    <MonthView
      v-else-if="view === 'month'"
      :currentDate="currentDate"
      :meetingsByDate="meetingsByDate"
      @select-date="date => emit('selectDate', date)"
      @select-meeting="meeting => emit('selectMeeting', meeting)"
    />

    <WeekView
      v-else-if="view === 'week'"
      :currentDate="currentDate"
      :meetingsByDate="meetingsByDate"
      @select-date="date => emit('selectDate', date)"
      @select-meeting="meeting => emit('selectMeeting', meeting)"
    />

    <DayView
      v-else-if="view === 'day'"
      :currentDate="currentDate"
      :meetingsByDate="meetingsByDate"
      @select-date="date => emit('selectDate', date)"
      @select-meeting="meeting => emit('selectMeeting', meeting)"
    />
  </div>
</template>
