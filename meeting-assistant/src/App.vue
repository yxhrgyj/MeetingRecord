<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useApi } from '@/composables/useApi.js'
import { useDateUtils } from '@/composables/useDateUtils.js'
import CalendarView from '@/components/CalendarView.vue'
import MeetingEditor from '@/components/MeetingEditor.vue'
import MeetingDetail from '@/components/MeetingDetail.vue'

const api = useApi()
const dt = useDateUtils()

const currentDate = ref(dt.today())
const currentView = ref('month')
const meetings = ref([])
const loading = ref(false)

// 全屏页面状态
const pageMode = ref(null)       // 'editor' | 'detail'
const editingMeeting = ref(null) // 编辑中的会议数据
const selectedMeeting = ref(null)

const viewTitle = computed(() => {
  if (currentView.value === 'month') return dt.formatMonth(currentDate.value)
  if (currentView.value === 'week') {
    const start = dt.startOfWeek(currentDate.value)
    const end = dt.addDays(start, 6)
    return `${dt.formatDate(start)} ~ ${dt.formatDate(end)}`
  }
  return dt.formatDisplay(currentDate.value)
})

async function loadMeetings() {
  loading.value = true
  try {
    const data = await api.fetchMeetings(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1)
    meetings.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error('加载失败:', e)
    meetings.value = []
  } finally {
    loading.value = false
  }
}

function getMeetingsForDate(dateStr) {
  return meetings.value.filter(m => m.date === dateStr)
}

function navigate(dir) {
  if (currentView.value === 'month') currentDate.value = dt.addMonths(currentDate.value, dir)
  else if (currentView.value === 'week') currentDate.value = dt.addWeeks(currentDate.value, dir)
  else currentDate.value = dt.addDays(currentDate.value, dir)
}

function goToday() {
  currentDate.value = dt.today()
  currentView.value = 'month'
}

// 打开全屏编辑器（新建）
function openNewRecord(dateStr = null) {
  editingMeeting.value = {
    date: dateStr || dt.formatDate(new Date()),
    startTime: '',
    endTime: '',
    attendees: [],
    content: ''
  }
  pageMode.value = 'editor'
}

// 打开全屏编辑器（编辑已有记录）
function openEditRecord(meeting) {
  editingMeeting.value = { ...meeting }
  pageMode.value = 'editor'
}

// 打开详情页
function openDetail(meeting) {
  selectedMeeting.value = meeting
  pageMode.value = 'detail'
}

function closePage() {
  pageMode.value = null
  editingMeeting.value = null
  selectedMeeting.value = null
}

async function handleSave(formData) {
  try {
    if (formData.id) {
      await api.updateMeeting(formData.id, formData)
    } else {
      await api.createMeeting(formData)
    }
    await loadMeetings()
    closePage()
  } catch (e) {
    alert('保存失败: ' + e.message)
  }
}

async function handleDelete(id) {
  if (!confirm('确定要删除这条会议纪要吗？')) return
  try {
    await api.deleteMeeting(id)
    await loadMeetings()
    closePage()
  } catch (e) {
    alert('删除失败: ' + e.message)
  }
}

async function handleExport(meeting) {
  try {
    const blob = await api.exportMeeting(meeting.id)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `会议纪要-${meeting.title}-${meeting.date}.md`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败: ' + e.message)
  }
}

async function handleExportMonth() {
  try {
    const blob = await api.exportMonth(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `会议纪要月报-${currentDate.value.getFullYear()}年${currentDate.value.getMonth() + 1}月.md`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败: ' + e.message)
  }
}

watch([currentDate, currentView], () => {
  if (currentView.value === 'month') loadMeetings()
})

onMounted(loadMeetings)
</script>

<template>
  <div class="flex flex-col h-screen bg-slate-50">
    <!-- 顶部导航 -->
    <header class="flex-shrink-0 bg-white border-b border-slate-200/80 px-6 py-3">
      <div class="flex items-center justify-between max-w-[1600px] mx-auto">
        <div class="flex items-center gap-4">
          <h1 class="text-lg font-semibold text-slate-800 tracking-tight">
            <span class="text-primary-600">📋</span> 会议记录助手
          </h1>
          <div class="h-5 w-px bg-slate-200"></div>
          <h2 class="text-sm font-medium text-slate-600">{{ viewTitle }}</h2>
        </div>

        <div class="flex items-center gap-2">
          <!-- 视图切换 -->
          <div class="flex bg-slate-100 rounded-lg p-0.5">
            <button
              v-for="v in [
                { key: 'month', label: '月' },
                { key: 'week', label: '周' },
                { key: 'day', label: '日' }
              ]"
              :key="v.key"
              @click="currentView = v.key"
              :class="[
                'px-3.5 py-1.5 text-xs font-medium rounded-md transition-all duration-150',
                currentView === v.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              ]"
            >{{ v.label }}</button>
          </div>

          <div class="h-5 w-px bg-slate-200 mx-1"></div>

          <button @click="goToday" class="btn-secondary text-xs px-3 py-1.5">今天</button>
          <button @click="navigate(-1)" class="btn-ghost">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button @click="navigate(1)" class="btn-ghost">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>

          <div class="h-5 w-px bg-slate-200 mx-1"></div>

          <button @click="openNewRecord()" class="btn-primary text-xs px-3 py-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            新建纪要
          </button>
          <button @click="handleExportMonth" class="btn-secondary text-xs px-3 py-1.5">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            导出月报
          </button>
        </div>
      </div>
    </header>

    <!-- 日历主体 -->
    <div class="flex-1 flex overflow-hidden">
      <main class="flex-1 overflow-auto p-4">
        <div class="max-w-[1600px] mx-auto h-full">
          <CalendarView
            :currentDate="currentDate"
            :view="currentView"
            :meetings="meetings"
            :loading="loading"
            @select-date="openNewRecord"
            @select-meeting="openDetail"
          />
        </div>
      </main>
    </div>

    <!-- 全屏 Overlay：编辑器 -->
    <Transition name="page">
      <div v-if="pageMode === 'editor'" class="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col">
        <MeetingEditor
          :initialData="editingMeeting"
          @save="handleSave"
          @close="closePage"
        />
      </div>
    </Transition>

    <!-- 全屏 Overlay：详情 -->
    <Transition name="page">
      <div v-if="pageMode === 'detail' && selectedMeeting" class="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col">
        <MeetingDetail
          :meeting="selectedMeeting"
          @edit="openEditRecord"
          @delete="handleDelete"
          @export="handleExport"
          @close="closePage"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.page-enter-active {
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}
.page-leave-active {
  transition: opacity 0.15s ease-in, transform 0.15s ease-in;
}
.page-enter-from {
  opacity: 0;
  transform: scale(0.98);
}
.page-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
