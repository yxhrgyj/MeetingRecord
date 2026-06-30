<script setup>
import { reactive, computed, onMounted } from 'vue'
import { useDateUtils } from '@/composables/useDateUtils.js'

const props = defineProps({
  initialData: Object
})

const emit = defineEmits(['save', 'cancel'])

const dt = useDateUtils()

const form = reactive({
  id: '',
  title: '',
  date: dt.formatDate(new Date()),
  startTime: '09:00',
  endTime: '10:00',
  attendees: [],
  agendaItems: [''],
  discussionPoints: '',
  decisions: [''],
  actionItems: [],
  notes: ''
})

const attendeeInput = reactive({ value: '' })
const agendaInputs = reactive({ values: [''] })
const decisionInputs = reactive({ values: [''] })

const actionItems = reactive({
  list: []
})

function initForm() {
  if (props.initialData) {
    Object.assign(form, {
      id: props.initialData.id || '',
      title: props.initialData.title || '',
      date: props.initialData.date || dt.formatDate(new Date()),
      startTime: props.initialData.startTime || '09:00',
      endTime: props.initialData.endTime || '10:00',
      attendees: [...(props.initialData.attendees || [])],
      agendaItems: props.initialData.agendaItems?.length ? [...props.initialData.agendaItems] : [''],
      discussionPoints: props.initialData.discussionPoints || '',
      decisions: props.initialData.decisions?.length ? [...props.initialData.decisions] : [''],
      actionItems: props.initialData.actionItems?.length
        ? props.initialData.actionItems.map(a => ({ ...a }))
        : [],
      notes: props.initialData.notes || ''
    })
    actionItems.list = props.initialData.actionItems?.length
      ? props.initialData.actionItems.map(a => ({
          content: a.content,
          assignee: a.assignee || '',
          deadline: a.deadline || '',
          completed: a.completed || false
        }))
      : []
  }
}

function addAttendee() {
  const name = attendeeInput.value.trim()
  if (name && !form.attendees.includes(name)) {
    form.attendees.push(name)
    attendeeInput.value = ''
  }
}

function removeAttendee(index) {
  form.attendees.splice(index, 1)
}

function addAgendaItem(index) {
  if (index === form.agendaItems.length - 1 && form.agendaItems[index]?.trim()) {
    form.agendaItems.push('')
  }
}

function removeAgendaItem(index) {
  if (form.agendaItems.length > 1) {
    form.agendaItems.splice(index, 1)
  }
}

function addDecision(index) {
  if (index === form.decisions.length - 1 && form.decisions[index]?.trim()) {
    form.decisions.push('')
  }
}

function removeDecision(index) {
  if (form.decisions.length > 1) {
    form.decisions.splice(index, 1)
  }
}

function addActionItem() {
  actionItems.list.push({ content: '', assignee: '', deadline: '', completed: false })
}

function removeActionItem(index) {
  actionItems.list.splice(index, 1)
}

function handleSubmit() {
  // 过滤空值
  const data = {
    ...form,
    agendaItems: form.agendaItems.filter(s => s.trim()),
    decisions: form.decisions.filter(s => s.trim()),
    actionItems: actionItems.list
      .filter(a => a.content.trim())
      .map(a => ({
        content: a.content.trim(),
        assignee: a.assignee.trim(),
        deadline: a.deadline,
        completed: a.completed
      }))
  }
  emit('save', data)
}

function handleAttendeeKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addAttendee()
  }
}

onMounted(initForm)
</script>

<template>
  <div class="p-6">
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <!-- 会议标题 -->
      <div>
        <label class="label-text">会议标题</label>
        <input
          v-model="form.title"
          type="text"
          class="input-field text-base font-medium"
          placeholder="输入会议标题..."
          required
        />
      </div>

      <!-- 日期时间 -->
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="label-text">日期</label>
          <input v-model="form.date" type="date" class="input-field" required />
        </div>
        <div>
          <label class="label-text">开始时间</label>
          <input v-model="form.startTime" type="time" class="input-field" />
        </div>
        <div>
          <label class="label-text">结束时间</label>
          <input v-model="form.endTime" type="time" class="input-field" />
        </div>
      </div>

      <!-- 参会人员 -->
      <div>
        <label class="label-text">参会人员</label>
        <div class="flex flex-wrap gap-1.5 mb-2">
          <span
            v-for="(name, i) in form.attendees"
            :key="i"
            class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-primary-50 text-primary-700 border border-primary-100"
          >
            {{ name }}
            <button type="button" @click="removeAttendee(i)" class="text-primary-400 hover:text-primary-600">&times;</button>
          </span>
        </div>
        <input
          v-model="attendeeInput.value"
          @keydown="handleAttendeeKeydown"
          @blur="addAttendee"
          type="text"
          class="input-field"
          placeholder="输入姓名后按回车添加..."
        />
      </div>

      <!-- 会议议题 -->
      <div>
        <label class="label-text">会议议题</label>
        <div class="space-y-2">
          <div v-for="(_, i) in form.agendaItems" :key="'agenda-' + i" class="flex items-center gap-2">
            <span class="text-xs text-slate-400 w-5">{{ i + 1 }}.</span>
            <input
              v-model="form.agendaItems[i]"
              @input="addAgendaItem(i)"
              type="text"
              class="input-field flex-1"
              :placeholder="`议题 ${i + 1}`"
            />
            <button
              v-if="form.agendaItems.length > 1"
              type="button"
              @click="removeAgendaItem(i)"
              class="text-slate-300 hover:text-red-400 transition-colors p-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 讨论要点 -->
      <div>
        <label class="label-text">讨论要点</label>
        <textarea
          v-model="form.discussionPoints"
          class="input-field min-h-[80px] resize-y"
          placeholder="记录会议讨论的关键内容..."
        ></textarea>
      </div>

      <!-- 会议决议 -->
      <div>
        <label class="label-text">会议决议</label>
        <div class="space-y-2">
          <div v-for="(_, i) in form.decisions" :key="'decision-' + i" class="flex items-center gap-2">
            <svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <input
              v-model="form.decisions[i]"
              @input="addDecision(i)"
              type="text"
              class="input-field flex-1"
              :placeholder="`决议 ${i + 1}`"
            />
            <button
              v-if="form.decisions.length > 1"
              type="button"
              @click="removeDecision(i)"
              class="text-slate-300 hover:text-red-400 transition-colors p-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 待办事项 -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="label-text !mb-0">待办事项</label>
          <button type="button" @click="addActionItem" class="text-xs text-primary-600 hover:text-primary-700 font-medium">
            + 添加
          </button>
        </div>

        <div v-if="actionItems.list.length === 0" class="text-xs text-slate-400 py-3 text-center">
          暂无待办事项
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="(item, i) in actionItems.list"
            :key="'action-' + i"
            class="flex items-start gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100"
          >
            <input
              v-model="item.completed"
              type="checkbox"
              class="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <div class="flex-1 space-y-2">
              <input
                v-model="item.content"
                type="text"
                class="input-field !border-transparent !bg-white !py-1.5"
                placeholder="待办内容..."
              />
              <div class="flex gap-2">
                <input
                  v-model="item.assignee"
                  type="text"
                  class="input-field flex-1 !py-1 text-xs"
                  placeholder="负责人"
                />
                <input
                  v-model="item.deadline"
                  type="date"
                  class="input-field !w-32 !py-1 text-xs"
                />
              </div>
            </div>
            <button
              type="button"
              @click="removeActionItem(i)"
              class="text-slate-300 hover:text-red-400 transition-colors p-1 mt-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 备注 -->
      <div>
        <label class="label-text">备注</label>
        <textarea
          v-model="form.notes"
          class="input-field min-h-[60px] resize-y"
          placeholder="其他需要记录的内容..."
        ></textarea>
      </div>

      <!-- 操作按钮 -->
      <div class="flex items-center gap-3 pt-2 border-t border-slate-100">
        <button type="submit" class="btn-primary flex-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          {{ form.id ? '更新会议' : '创建会议' }}
        </button>
        <button type="button" @click="emit('cancel')" class="btn-secondary">取消</button>
      </div>
    </form>
  </div>
</template>
