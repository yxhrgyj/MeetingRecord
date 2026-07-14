<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useApi } from '@/composables/useApi.js'
import { useDateUtils } from '@/composables/useDateUtils.js'
import CalendarToolbar from '@/components/CalendarToolbar.vue'
import CalendarView from '@/components/CalendarView.vue'
import MeetingEditor from '@/components/MeetingEditor.vue'
import MeetingDetail from '@/components/MeetingDetail.vue'
import ModelSettingsDialog from '@/components/ModelSettingsDialog.vue'

const api = useApi()
const dt = useDateUtils()

const currentDate = ref(dt.today())
const mobileViewport = window.matchMedia?.('(max-width: 767px)')
const currentView = ref(mobileViewport?.matches ? 'day' : 'month')
const meetings = ref([])
const loading = ref(false)
const modelSettingsOpen = ref(false)
const modelGatewayUrl = ref('https://model.yxhrgyj.cc.cd')
const modelGatewayLoading = ref(false)
const modelGatewaySaving = ref(false)
const modelGatewayStatus = ref('')

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

async function handleExport(meeting, format = 'docx') {
  try {
    const blob = await api.exportMeeting(meeting.id, format)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const extension = format === 'md' ? 'md' : 'docx'
    a.download = `会议纪要-${meeting.title}-${meeting.date}.${extension}`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败: ' + e.message)
  }
}

async function handleExportMonth() {
  try {
    const blob = await api.exportMonth(currentDate.value.getFullYear(), currentDate.value.getMonth() + 1, 'docx')
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `会议纪要月报-${currentDate.value.getFullYear()}年${currentDate.value.getMonth() + 1}月.docx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('导出失败: ' + e.message)
  }
}

async function openModelSettings() {
  modelSettingsOpen.value = true
  modelGatewayStatus.value = ''
  modelGatewayLoading.value = true
  try {
    const settings = await api.getModelGatewaySettings()
    modelGatewayUrl.value = settings.modelGatewayUrl || 'https://model.yxhrgyj.cc.cd'
  } catch (e) {
    modelGatewayStatus.value = '加载模型设置失败: ' + e.message
  } finally {
    modelGatewayLoading.value = false
  }
}

function closeModelSettings() {
  modelSettingsOpen.value = false
  modelGatewayStatus.value = ''
}

async function saveModelGatewaySettings() {
  modelGatewaySaving.value = true
  modelGatewayStatus.value = ''
  try {
    const settings = await api.updateModelGatewaySettings(modelGatewayUrl.value)
    modelGatewayUrl.value = settings.modelGatewayUrl || ''
    modelGatewayStatus.value = '模型地址已保存'
  } catch (e) {
    modelGatewayStatus.value = '保存失败: ' + e.message
  } finally {
    modelGatewaySaving.value = false
  }
}

async function testModelGateway() {
  modelGatewaySaving.value = true
  modelGatewayStatus.value = ''
  try {
    const health = await api.testModelGateway()
    modelGatewayStatus.value = health.ok ? '模型服务连接正常' : `模型服务异常: ${health.status}`
  } catch (e) {
    modelGatewayStatus.value = '连接失败: ' + e.message
  } finally {
    modelGatewaySaving.value = false
  }
}

watch([currentDate, currentView], () => {
  if (currentView.value === 'month') loadMeetings()
})

onMounted(loadMeetings)
</script>

<template>
  <div class="flex flex-col h-screen bg-slate-50">
    <CalendarToolbar
      v-model:view="currentView"
      :title="viewTitle"
      @navigate="navigate"
      @today="goToday"
      @create="openNewRecord()"
      @model-settings="openModelSettings"
      @export-month="handleExportMonth"
    />

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
          @export="handleExport"
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

    <Transition name="page">
      <ModelSettingsDialog
        v-if="modelSettingsOpen"
        v-model="modelGatewayUrl"
        :loading="modelGatewayLoading"
        :saving="modelGatewaySaving"
        :status="modelGatewayStatus"
        @close="closeModelSettings"
        @test="testModelGateway"
        @save="saveModelGatewaySettings"
      />
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
