<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMeetingStore } from '@/stores/meeting'
import { NButton, NIcon, NTag, NDivider, NSpin, NModal, useMessage } from 'naive-ui'
import { ArrowBack, CreateOutline, TrashOutline, TimeOutline, LocationOutline, PeopleOutline } from '@vicons/ionicons5'
import MeetingForm from '@/components/MeetingForm.vue'
import type { Meeting, MeetingType } from '@/types'
import { MeetingTypeLabels } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useMeetingStore()
const message = useMessage()

const meetingId = computed(() => route.params.id as string)
const meeting = computed(() => store.meetings.find(m => m.id === meetingId.value))
const showEditModal = ref(false)

function getTypeColor(type: MeetingType): string {
  const colors: Record<MeetingType, string> = {
    general: '#6366f1',
    project: '#f59e0b',
    client: '#10b981',
    internal: '#3b82f6',
    brainstorm: '#ec4899'
  }
  return colors[type] || colors.general
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function getDayOfWeek(dateStr: string): string {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const d = new Date(dateStr)
  return `星期${days[d.getDay()]}`
}

async function handleDelete() {
  if (!meeting.value) return
  const success = await store.deleteMeeting(meeting.value.id)
  if (success) {
    message.success('会议记录已删除')
    router.push('/')
  } else {
    message.error('删除失败')
  }
}

async function onEditSaved(updated: Meeting) {
  showEditModal.value = false
  await store.fetchMeetings()
  message.success('会议记录已更新')
}

onMounted(async () => {
  if (!store.meetings.length) {
    await store.fetchMeetings()
  }
})
</script>

<template>
  <div class="detail-page">
    <NSpin :show="store.loading && !meeting">
      <div v-if="meeting" class="detail-content">
        <!-- 头部 -->
        <div class="detail-header">
          <NButton text @click="router.push('/')">
            <template #icon><NIcon><ArrowBack /></NIcon></template>
          </NButton>
          <div class="header-info">
            <h2 class="detail-title">{{ meeting.title }}</h2>
            <div class="header-meta">
              <NTag :color="{ color: getTypeColor(meeting.meeting_type), textColor: '#fff' }" size="small">
                {{ MeetingTypeLabels[meeting.meeting_type] }}
              </NTag>
            </div>
          </div>
          <div class="header-actions">
            <NButton size="small" @click="showEditModal = true">
              <template #icon><NIcon><CreateOutline /></NIcon></template>
              编辑
            </NButton>
            <NButton size="small" type="error" ghost @click="handleDelete">
              <template #icon><NIcon><TrashOutline /></NIcon></template>
            </NButton>
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="info-cards">
          <div class="info-card">
            <div class="info-icon"><NIcon size="18"><TimeOutline /></NIcon></div>
            <div class="info-text">
              <div class="info-label">日期</div>
              <div class="info-value">{{ formatDate(meeting.meeting_date) }} {{ getDayOfWeek(meeting.meeting_date) }}</div>
            </div>
          </div>
          <div class="info-card" v-if="meeting.start_time">
            <div class="info-icon"><NIcon size="18"><TimeOutline /></NIcon></div>
            <div class="info-text">
              <div class="info-label">时间</div>
              <div class="info-value">{{ meeting.start_time }} {{ meeting.end_time ? ' - ' + meeting.end_time : '' }}</div>
            </div>
          </div>
          <div class="info-card" v-if="meeting.location">
            <div class="info-icon"><NIcon size="18"><LocationOutline /></NIcon></div>
            <div class="info-text">
              <div class="info-label">地点</div>
              <div class="info-value">{{ meeting.location }}</div>
            </div>
          </div>
        </div>

        <!-- 参会人员 -->
        <div v-if="meeting.participants?.length" class="section">
          <h3 class="section-title"><NIcon size="18"><PeopleOutline /></NIcon> 参会人员</h3>
          <div class="participant-tags">
            <NTag v-for="p in meeting.participants" :key="p" size="small" style="margin: 2px;">{{ p }}</NTag>
          </div>
        </div>

        <!-- 会议议题 -->
        <div v-if="meeting.agenda" class="section">
          <h3 class="section-title">会议议题</h3>
          <p class="section-body">{{ meeting.agenda }}</p>
        </div>

        <!-- 会议记录 -->
        <div v-if="meeting.notes" class="section">
          <h3 class="section-title">会议记录</h3>
          <p class="section-body notes-body">{{ meeting.notes }}</p>
        </div>

        <!-- 会议结论 -->
        <div v-if="meeting.conclusion" class="section">
          <h3 class="section-title">会议结论</h3>
          <p class="section-body">{{ meeting.conclusion }}</p>
        </div>

        <!-- 待办事项 -->
        <div v-if="meeting.action_items?.length" class="section">
          <h3 class="section-title">待办事项</h3>
          <div class="action-list">
            <div
              v-for="item in meeting.action_items"
              :key="item.id"
              class="action-item"
              :class="{ completed: item.completed }"
            >
              <div class="action-check" :class="{ checked: item.completed }">
                <span v-if="item.completed">✓</span>
              </div>
              <div class="action-detail">
                <span :class="{ 'line-through': item.completed }">{{ item.content }}</span>
                <span class="action-assignee">@{{ item.assignee }}</span>
                <span v-if="item.due_date" class="action-due">截止 {{ item.due_date }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="!meeting.agenda && !meeting.notes && !meeting.conclusion && !meeting.action_items?.length" class="empty-hint">
          暂无详细记录，点击"编辑"补充内容
        </div>
      </div>

      <!-- 未找到 -->
      <div v-else-if="!store.loading" class="not-found">
        <p>未找到该会议记录</p>
        <NButton type="primary" @click="router.push('/')">返回日历</NButton>
      </div>
    </NSpin>

    <!-- 编辑模态框 -->
    <NModal
      v-model:show="showEditModal"
      preset="card"
      title="编辑会议记录"
      style="max-width: 640px;"
      :mask-closable="false"
    >
      <MeetingForm
        v-if="meeting"
        :date="meeting.meeting_date"
        :meeting="meeting"
        @saved="onEditSaved"
        @cancel="showEditModal = false"
      />
    </NModal>
  </div>
</template>

<style scoped>
.detail-page {
  max-width: 680px;
  margin: 0 auto;
}

.detail-content {
  background: var(--card-bg);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.detail-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 16px;
}

.header-info {
  flex: 1;
  min-width: 0;
}

.detail-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin-bottom: 4px;
  word-break: break-all;
}

.header-meta {
  display: flex;
  gap: 6px;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* 信息卡片 */
.info-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.info-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg);
  padding: 8px 12px;
  border-radius: 8px;
  flex: 1;
  min-width: 140px;
}

.info-icon {
  color: var(--primary);
  flex-shrink: 0;
}

.info-label {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

.info-value {
  font-size: 0.85rem;
  font-weight: 500;
}

/* 内容分区 */
.section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.section-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.section-body {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--text);
  white-space: pre-wrap;
}

.notes-body {
  background: var(--bg);
  padding: 12px;
  border-radius: 8px;
  border-left: 3px solid var(--primary);
}

/* 待办列表 */
.action-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px;
  background: var(--bg);
  border-radius: 8px;
  transition: opacity 0.2s;
}
.action-item.completed {
  opacity: 0.6;
}

.action-check {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  flex-shrink: 0;
  margin-top: 1px;
}
.action-check.checked {
  background: var(--success);
  border-color: var(--success);
  color: white;
}

.action-detail {
  font-size: 0.85rem;
  line-height: 1.5;
}

.action-assignee {
  color: var(--primary);
  font-weight: 500;
  margin-left: 4px;
}

.action-due {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-left: 6px;
}

.participant-tags {
  display: flex;
  flex-wrap: wrap;
}

.empty-hint {
  text-align: center;
  color: var(--text-secondary);
  padding: 32px 0;
}

.not-found {
  text-align: center;
  padding: 48px 16px;
}
.not-found p {
  margin-bottom: 16px;
  color: var(--text-secondary);
}

.line-through {
  text-decoration: line-through;
}

@media (max-width: 640px) {
  .detail-content {
    padding: 12px;
    border-radius: 8px;
  }
  .detail-title {
    font-size: 1.1rem;
  }
  .header-actions {
    flex-direction: column;
  }
}
</style>
