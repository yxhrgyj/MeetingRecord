<script setup lang="ts">
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useMeetingStore } from '@/stores/meeting'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarOptions, EventClickArg, DateSelectArg } from '@fullcalendar/core'
import { NButton, NIcon, NModal, NSpin, NTag, useMessage } from 'naive-ui'
import { AddOutline, ChevronBack, ChevronForward, TodayOutline, ListOutline, CalendarOutline } from '@vicons/ionicons5'
import MeetingForm from '@/components/MeetingForm.vue'
import type { Meeting, CalendarViewMode } from '@/types'
import { MeetingTypeLabels } from '@/types'

const router = useRouter()
const store = useMeetingStore()
const message = useMessage()

const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null)
const showForm = ref(false)
const selectedDate = ref('')
const editingMeeting = ref<Meeting | null>(null)
const currentView = ref<CalendarViewMode>('dayGridMonth')
const calendarTitle = ref('')

// 移动端检测
const isMobile = computed(() => window.innerWidth < 640)

// FullCalendar 配置
const calendarOptions = computed<CalendarOptions>(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView: isMobile.value ? 'timeGridDay' : currentView.value,
  headerToolbar: false,
  height: 'auto',
  selectable: true,
  selectMirror: true,
  dayMaxEvents: isMobile.value ? 1 : 3,
  weekends: true,
  locale: 'zh-cn',
  firstDay: 1, // 周一为第一天
  allDaySlot: false,
  slotMinTime: '07:00:00',
  slotMaxTime: '22:00:00',
  slotDuration: '00:30:00',
  nowIndicator: true,
  events: store.meetings.map(toCalendarEvent),
  dateClick: handleDateClick,
  eventClick: handleEventClick,
  select: handleSelect,
  viewDidMount: (arg: any) => {
    calendarTitle.value = arg.view.title
  },
  // 自定义日期单元格，显示会议标记
  dayCellContent: (arg: any) => {
    const count = store.dateCountMap[arg.date.toISOString().slice(0, 10)] || 0
    return {
      html: `
        <div class="day-cell-content">
          <span class="day-number">${arg.dayNumberText}</span>
          ${count > 0 ? `<span class="day-count-badge">${count}</span>` : ''}
        </div>
      `
    }
  }
}))

function toCalendarEvent(m: Meeting) {
  return {
    id: m.id,
    title: m.title,
    date: m.meeting_date,
    start: m.start_time ? `${m.meeting_date}T${m.start_time}` : m.meeting_date,
    end: m.end_time ? `${m.meeting_date}T${m.end_time}` : undefined,
    backgroundColor: getTypeColor(m.meeting_type),
    borderColor: getTypeColor(m.meeting_type),
    textColor: '#ffffff',
    extendedProps: {
      meeting_type: m.meeting_type,
      participants: m.participants,
      location: m.location
    }
  }
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    general: '#6366f1',
    project: '#f59e0b',
    client: '#10b981',
    internal: '#3b82f6',
    brainstorm: '#ec4899'
  }
  return colors[type] || colors.general
}

// 日历操作
function handleDateClick(info: any) {
  selectedDate.value = info.dateStr
  editingMeeting.value = null
  showForm.value = true
}

function handleEventClick(info: EventClickArg) {
  const meeting = store.meetings.find(m => m.id === info.event.id)
  if (meeting) {
    router.push(`/meeting/${meeting.id}`)
  }
}

function handleSelect(info: DateSelectArg) {
  selectedDate.value = info.startStr
  editingMeeting.value = null
  showForm.value = true
  calendarRef.value?.getApi().unselect()
}

function goToday() {
  calendarRef.value?.getApi().today()
}

function goPrev() {
  calendarRef.value?.getApi().prev()
}

function goNext() {
  calendarRef.value?.getApi().next()
}

function switchView(view: CalendarViewMode) {
  currentView.value = view
  calendarRef.value?.getApi().changeView(view)
}

async function onFormSaved(meeting: Meeting) {
  showForm.value = false
  await store.fetchMeetings()
  message.success('会议记录已保存')
}

async function onFormDelete() {
  showForm.value = false
  await store.fetchMeetings()
  message.success('会议记录已删除')
}

onMounted(async () => {
  await store.fetchMeetings()
})

// 监听窗口大小变化
watch(isMobile, (mobile) => {
  if (mobile && currentView.value === 'dayGridMonth') {
    switchView('timeGridDay')
  }
})
</script>

<template>
  <div class="calendar-page">
    <!-- 顶部工具栏 -->
    <div class="calendar-toolbar">
      <div class="toolbar-left">
        <NButton size="small" @click="goToday">
          <template #icon><NIcon><TodayOutline /></NIcon></template>
          今天
        </NButton>
        <div class="nav-btns">
          <NButton size="small" quaternary circle @click="goPrev">
            <template #icon><NIcon><ChevronBack /></NIcon></template>
          </NButton>
          <NButton size="small" quaternary circle @click="goNext">
            <template #icon><NIcon><ChevronForward /></NIcon></template>
          </NButton>
        </div>
        <h2 class="calendar-title">{{ calendarTitle }}</h2>
      </div>
      <div class="toolbar-right">
        <!-- 桌面端视图切换 -->
        <div v-if="!isMobile" class="view-switcher">
          <NButton
            size="small"
            :type="currentView === 'dayGridMonth' ? 'primary' : 'default'"
            @click="switchView('dayGridMonth')"
            ghost
          >月</NButton>
          <NButton
            size="small"
            :type="currentView === 'timeGridWeek' ? 'primary' : 'default'"
            @click="switchView('timeGridWeek')"
            ghost
          >周</NButton>
          <NButton
            size="small"
            :type="currentView === 'timeGridDay' ? 'primary' : 'default'"
            @click="switchView('timeGridDay')"
            ghost
          >日</NButton>
        </div>
        <!-- 移动端视图切换 -->
        <div v-else class="view-switcher-mobile">
          <NButton size="small" @click="switchView(currentView === 'dayGridMonth' ? 'timeGridWeek' : currentView === 'timeGridWeek' ? 'timeGridDay' : 'dayGridMonth')">
            <template #icon>
              <NIcon><component :is="currentView === 'dayGridMonth' ? ListOutline : CalendarOutline" /></NIcon>
            </template>
            {{ currentView === 'dayGridMonth' ? '列表' : currentView === 'timeGridWeek' ? '日' : '月' }}
          </NButton>
        </div>
      </div>
    </div>

    <!-- 日历主体 -->
    <div class="calendar-container">
      <NSpin :show="store.loading">
        <FullCalendar ref="calendarRef" :options="calendarOptions" />
      </NSpin>
    </div>

    <!-- 悬浮添加按钮 -->
    <div class="fab" @click="selectedDate = new Date().toISOString().slice(0,10); editingMeeting = null; showForm = true">
      <NIcon size="24" color="#fff"><AddOutline /></NIcon>
    </div>

    <!-- 会议表单模态框 -->
    <NModal
      v-model:show="showForm"
      preset="card"
      :title="editingMeeting ? '编辑会议记录' : '新建会议记录'"
      style="max-width: 640px;"
      :mask-closable="false"
    >
      <MeetingForm
        :date="selectedDate"
        :meeting="editingMeeting"
        @saved="onFormSaved"
        @cancel="showForm = false"
        @deleted="onFormDelete"
      />
    </NModal>
  </div>
</template>

<style scoped>
.calendar-page {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.calendar-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0 12px;
  gap: 8px;
  flex-wrap: wrap;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-btns {
  display: flex;
  gap: 2px;
}

.calendar-title {
  font-size: 1rem;
  font-weight: 600;
  margin-left: 4px;
  white-space: nowrap;
}

.view-switcher {
  display: flex;
  gap: 4px;
}

.view-switcher-mobile {
  display: flex;
}

.calendar-container {
  flex: 1;
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  overflow-y: auto;
}

/* 悬浮按钮 */
.fab {
  position: fixed;
  bottom: 24px;
  right: 24px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 4px 16px rgba(79, 70, 229, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 50;
  transition: transform 0.2s, box-shadow 0.2s;
}
.fab:active {
  transform: scale(0.95);
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.2);
}

/* 移动端适配 */
@media (max-width: 640px) {
  .calendar-toolbar {
    padding: 4px 0 8px;
  }
  .calendar-title {
    font-size: 0.9rem;
  }
  .calendar-container {
    padding: 4px;
    border-radius: 8px;
  }
  .fab {
    bottom: 16px;
    right: 16px;
    width: 44px;
    height: 44px;
  }
}
</style>

<!-- 注入全局样式到 FullCalendar 的日单元格 -->
<style>
.day-cell-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 2px;
  min-height: 28px;
}
.day-number {
  font-size: 0.8rem;
  font-weight: 500;
}
.day-count-badge {
  font-size: 0.65rem;
  background: var(--primary);
  color: white;
  border-radius: 8px;
  padding: 1px 5px;
  margin-top: 2px;
  line-height: 1.2;
  min-width: 16px;
  text-align: center;
}

/* 移动端日历调整 */
@media (max-width: 640px) {
  .fc .fc-toolbar-title {
    font-size: 1rem !important;
  }
  .fc .fc-button {
    font-size: 0.75rem !important;
    padding: 0.25em 0.6em !important;
  }
  .fc .fc-daygrid-day-number {
    font-size: 0.75rem !important;
  }
  .fc .fc-daygrid-day-events {
    display: none;
  }
}
</style>
