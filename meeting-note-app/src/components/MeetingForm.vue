<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useMeetingStore } from '@/stores/meeting'
import {
  NForm, NFormItem, NInput, NSelect, NDatePicker, NTimePicker,
  NButton, NSpace, NDivider, NText, NTag, useMessage
} from 'naive-ui'
import type { Meeting, MeetingType, ActionItem } from '@/types'
import { MeetingTypeLabels, createEmptyMeeting, defaultTemplates } from '@/types'

const props = defineProps<{
  date: string
  meeting: Meeting | null
}>()

const emit = defineEmits<{
  saved: [meeting: Meeting]
  cancel: []
  deleted: []
}>()

const store = useMeetingStore()
const message = useMessage()

// 表单数据
const formData = ref<Partial<Meeting>>(createEmptyMeeting(props.date))
const selectedTemplate = ref<string | null>(null)

// 参与者输入
const participantInput = ref('')

// 待办事项
const actionItems = ref<ActionItem[]>([])
const newActionContent = ref('')
const newActionAssignee = ref('')

// 初始化表单
watch(() => props.meeting, (meeting) => {
  if (meeting) {
    formData.value = { ...meeting }
    actionItems.value = [...(meeting.action_items || [])]
    selectedTemplate.value = meeting.template_id
  } else {
    formData.value = createEmptyMeeting(props.date)
    actionItems.value = []
    selectedTemplate.value = null
  }
}, { immediate: true })

// 模板列表
const templates = computed(() => defaultTemplates)

// 当前选中的模板
const activeTemplate = computed(() => {
  if (!selectedTemplate.value) return null
  return templates.value.find(t => t.name === selectedTemplate.value)
})

// 选择模板
function onTemplateSelect(name: string) {
  selectedTemplate.value = name
  const tmpl = templates.value.find(t => t.name === name)
  if (tmpl) {
    formData.value.meeting_type = tmpl.meeting_type
  }
}

// 添加参与者
function addParticipant() {
  const name = participantInput.value.trim()
  if (name && !formData.value.participants?.includes(name)) {
    formData.value.participants = [...(formData.value.participants || []), name]
    participantInput.value = ''
  }
}

function removeParticipant(name: string) {
  formData.value.participants = formData.value.participants?.filter(p => p !== name) || []
}

// 添加待办事项
function addActionItem() {
  const content = newActionContent.value.trim()
  if (content) {
    actionItems.value.push({
      id: crypto.randomUUID(),
      content,
      assignee: newActionAssignee.value.trim() || '待分配',
      due_date: null,
      completed: false
    })
    newActionContent.value = ''
    newActionAssignee.value = ''
  }
}

function removeActionItem(id: string) {
  actionItems.value = actionItems.value.filter(a => a.id !== id)
}

function toggleActionItem(id: string) {
  const item = actionItems.value.find(a => a.id === id)
  if (item) item.completed = !item.completed
}

// 提交表单
async function handleSubmit() {
  if (!formData.value.title?.trim()) {
    message.warning('请输入会议标题')
    return
  }

  const payload = {
    ...formData.value,
    action_items: actionItems.value
  } as Partial<Meeting>

  let result: Meeting | null = null

  if (props.meeting?.id) {
    const success = await store.updateMeeting(props.meeting.id, payload)
    if (success) {
      result = { ...props.meeting, ...payload } as Meeting
    }
  } else {
    result = await store.createMeeting(payload)
  }

  if (result) {
    emit('saved', result)
  } else {
    message.error('保存失败，请重试')
  }
}

async function handleDelete() {
  if (!props.meeting?.id) return
  const success = await store.deleteMeeting(props.meeting.id)
  if (success) {
    emit('deleted')
  } else {
    message.error('删除失败')
  }
}

// 会议类型色标
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
</script>

<template>
  <div class="meeting-form">
    <!-- 模板选择 -->
    <div class="template-section">
      <NText depth="3" style="font-size: 0.8rem; margin-bottom: 8px; display: block;">选择记录模板</NText>
      <div class="template-chips">
        <NTag
          v-for="tmpl in templates"
          :key="tmpl.name"
          :type="selectedTemplate === tmpl.name ? 'primary' : 'default'"
          :bordered="selectedTemplate !== tmpl.name"
          size="medium"
          style="cursor: pointer; margin-right: 8px; margin-bottom: 4px;"
          @click="onTemplateSelect(tmpl.name)"
        >
          {{ tmpl.name }}
        </NTag>
      </div>
    </div>

    <NDivider style="margin: 12px 0;" />

    <!-- 表单 -->
    <NForm label-placement="top" size="medium">
      <NFormItem label="会议标题" required>
        <NInput v-model:value="formData.title" placeholder="输入会议标题" maxlength="100" show-count />
      </NFormItem>

      <NFormItem label="会议日期">
        <NDatePicker
          v-model:formatted-value="formData.meeting_date"
          type="date"
          value-format="yyyy-MM-dd"
          clearable
        />
      </NFormItem>

      <div class="time-row">
        <NFormItem label="开始时间">
          <NTimePicker
            v-model:formatted-value="formData.start_time"
            format="HH:mm"
            value-format="HH:mm"
            clearable
          />
        </NFormItem>
        <NFormItem label="结束时间">
          <NTimePicker
            v-model:formatted-value="formData.end_time"
            format="HH:mm"
            value-format="HH:mm"
            clearable
          />
        </NFormItem>
      </div>

      <NFormItem label="会议地点">
        <NInput v-model:value="formData.location" placeholder="会议室/线上链接" />
      </NFormItem>

      <NFormItem label="会议类型">
        <NSelect
          v-model:value="formData.meeting_type"
          :options="Object.entries(MeetingTypeLabels).map(([k, v]) => ({ label: v, value: k }))"
        />
      </NFormItem>

      <NFormItem label="参会人员">
        <div class="participant-input">
          <NInput
            v-model:value="participantInput"
            placeholder="输入姓名后按添加"
            @keyup.enter="addParticipant"
            style="flex: 1;"
          />
          <NButton size="small" type="primary" ghost @click="addParticipant">添加</NButton>
        </div>
        <div v-if="formData.participants?.length" class="participant-tags">
          <NTag
            v-for="p in formData.participants"
            :key="p"
            closable
            size="small"
            @close="removeParticipant(p)"
            style="margin: 2px;"
          >{{ p }}</NTag>
        </div>
      </NFormItem>

      <NFormItem label="会议议题">
        <NInput
          v-model:value="formData.agenda"
          type="textarea"
          placeholder="本次会议要讨论的议题"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
      </NFormItem>

      <NFormItem label="会议记录">
        <NInput
          v-model:value="formData.notes"
          type="textarea"
          placeholder="记录会议要点、讨论内容..."
          :autosize="{ minRows: 3, maxRows: 8 }"
        />
      </NFormItem>

      <NFormItem label="会议结论">
        <NInput
          v-model:value="formData.conclusion"
          type="textarea"
          placeholder="达成的共识、决策和结论"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
      </NFormItem>

      <!-- 待办事项 -->
      <NFormItem label="待办事项">
        <div class="action-items">
          <div v-for="item in actionItems" :key="item.id" class="action-item">
            <div class="action-status" :class="{ completed: item.completed }" @click="toggleActionItem(item.id)">
              <span v-if="item.completed">✓</span>
            </div>
            <div class="action-content">
              <span :class="{ 'line-through': item.completed }">{{ item.content }}</span>
              <span class="action-assignee">@{{ item.assignee }}</span>
            </div>
            <NButton text size="tiny" type="error" @click="removeActionItem(item.id)">删除</NButton>
          </div>
          <div class="add-action">
            <NInput v-model:value="newActionContent" placeholder="新待办事项" size="small" style="flex: 1;" @keyup.enter="addActionItem" />
            <NInput v-model:value="newActionAssignee" placeholder="负责人" size="small" style="width: 100px;" @keyup.enter="addActionItem" />
            <NButton size="small" type="primary" ghost @click="addActionItem">+</NButton>
          </div>
        </div>
      </NFormItem>
    </NForm>

    <!-- 底部按钮 -->
    <NDivider style="margin: 16px 0;" />
    <div class="form-actions">
      <div>
        <NButton v-if="meeting?.id" type="error" ghost size="small" @click="handleDelete">
          删除此记录
        </NButton>
      </div>
      <NSpace>
        <NButton @click="emit('cancel')">取消</NButton>
        <NButton type="primary" :loading="store.syncing" @click="handleSubmit">
          {{ meeting?.id ? '更新' : '保存' }}
        </NButton>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.meeting-form {
  max-height: 70vh;
  overflow-y: auto;
  padding: 4px 0;
}

.template-section {
  margin-bottom: 4px;
}

.template-chips {
  display: flex;
  flex-wrap: wrap;
}

.time-row {
  display: flex;
  gap: 16px;
}
.time-row > * {
  flex: 1;
}

.participant-input {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.participant-tags {
  display: flex;
  flex-wrap: wrap;
}

.action-items {
  width: 100%;
}

.action-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
}

.action-status {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;
}
.action-status.completed {
  background: var(--success);
  border-color: var(--success);
  color: white;
}

.action-content {
  flex: 1;
  min-width: 0;
}
.action-assignee {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin-left: 6px;
}

.add-action {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.line-through {
  text-decoration: line-through;
  color: var(--text-secondary);
}

/* 滚动条美化 */
.meeting-form::-webkit-scrollbar {
  width: 4px;
}
.meeting-form::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 2px;
}
</style>
