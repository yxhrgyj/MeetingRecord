<script setup>
import { ref } from 'vue'
import { CalendarDays, Clock3, Plus, Users, X } from '@lucide/vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  mode: { type: String, required: true }
})

const emit = defineEmits([
  'update:modelValue',
  'add-attendee',
  'remove-attendee',
  'content-keydown'
])

const attendeeInput = ref('')
const contentRef = ref(null)

function patch(values) {
  emit('update:modelValue', { ...props.modelValue, ...values })
}

function submitAttendee() {
  const name = attendeeInput.value.trim()
  if (!name) return
  emit('add-attendee', name)
  attendeeInput.value = ''
}

function handleAttendeeKeydown(event) {
  if (event.key !== 'Enter' && event.key !== ',') return
  event.preventDefault()
  submitAttendee()
}

function focusContent() {
  contentRef.value?.focus()
}

function getContentElement() {
  return contentRef.value
}

defineExpose({ focusContent, getContentElement })
</script>

<template>
  <article class="document-surface mx-auto min-h-full w-full max-w-[900px] px-5 py-8 sm:px-10 sm:py-11 lg:px-[58px]">
    <div class="mb-3 text-[11px] text-muted">{{ mode === 'read' ? '会议纪要' : '会议记录' }}</div>

    <template v-if="mode === 'edit'">
      <input
        :value="modelValue.title"
        type="text"
        data-field="title"
        aria-label="会议标题"
        class="focus-ring w-full rounded-control border-0 bg-transparent px-0 py-1 text-[28px] font-semibold leading-tight text-ink placeholder:text-black/20 sm:text-[31px]"
        placeholder="输入会议标题"
        @input="patch({ title: $event.target.value })"
      />

      <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-5 text-xs text-secondary">
        <label class="flex items-center gap-1.5">
          <CalendarDays :size="14" class="text-muted" />
          <span class="sr-only">会议日期</span>
          <input
            :value="modelValue.date"
            type="date"
            data-field="date"
            class="focus-ring rounded-control border-0 bg-transparent p-1 text-xs text-secondary"
            @input="patch({ date: $event.target.value })"
          />
        </label>

        <div class="flex items-center gap-1">
          <Clock3 :size="14" class="text-muted" />
          <label>
            <span class="sr-only">开始时间</span>
            <input
              :value="modelValue.startTime"
              type="time"
              data-field="start-time"
              class="focus-ring w-[86px] rounded-control border-0 bg-transparent p-1 text-xs text-secondary"
              @input="patch({ startTime: $event.target.value })"
            />
          </label>
          <span class="text-line">—</span>
          <label>
            <span class="sr-only">结束时间</span>
            <input
              :value="modelValue.endTime"
              type="time"
              data-field="end-time"
              class="focus-ring w-[86px] rounded-control border-0 bg-transparent p-1 text-xs text-secondary"
              @input="patch({ endTime: $event.target.value })"
            />
          </label>
        </div>

        <div class="flex min-w-[180px] flex-1 flex-wrap items-center gap-1.5">
          <Users :size="14" class="text-muted" />
          <span
            v-for="(name, index) in modelValue.attendees || []"
            :key="`${name}-${index}`"
            class="inline-flex items-center gap-1 rounded-full bg-canvas px-2 py-1 text-[10px] text-secondary"
          >
            {{ name }}
            <button
              type="button"
              data-action="remove-attendee"
              class="focus-ring rounded-full text-muted hover:text-recording"
              :aria-label="`移除参会人 ${name}`"
              @click="$emit('remove-attendee', index)"
            >
              <X :size="11" />
            </button>
          </span>
          <label class="flex min-w-[92px] flex-1 items-center gap-1 text-primary-600">
            <Plus :size="12" />
            <span class="sr-only">添加参会人</span>
            <input
              v-model="attendeeInput"
              type="text"
              data-field="attendee"
              class="focus-ring min-w-0 flex-1 rounded-control border-0 bg-transparent px-1 py-1 text-[11px] text-secondary placeholder:text-muted"
              placeholder="参会人"
              @keydown="handleAttendeeKeydown"
              @blur="submitAttendee"
            />
          </label>
        </div>
      </div>

      <div class="sticky top-0 z-10 -mx-2 border-b border-line bg-white/90 px-2 py-2 backdrop-blur-xl">
        <slot name="toolbar"></slot>
      </div>

      <textarea
        ref="contentRef"
        :value="modelValue.content"
        data-field="content"
        aria-label="会议正文"
        class="focus-ring mt-5 min-h-[430px] w-full resize-none rounded-control border-0 bg-transparent p-0 text-sm leading-7 text-secondary placeholder:text-black/25"
        placeholder="记录讨论要点，或从会议助手开始录音、上传音频。"
        @input="patch({ content: $event.target.value })"
        @keydown="$emit('content-keydown', $event)"
      ></textarea>
    </template>

    <template v-else>
      <h1 class="text-[28px] font-semibold leading-tight text-ink sm:text-[31px]">{{ modelValue.title }}</h1>
      <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line pb-5 text-xs text-secondary">
        <span v-if="modelValue.date" class="flex items-center gap-1.5">
          <CalendarDays :size="14" class="text-muted" />
          {{ modelValue.date }}
        </span>
        <span v-if="modelValue.startTime" class="flex items-center gap-1.5">
          <Clock3 :size="14" class="text-muted" />
          {{ modelValue.startTime }}<template v-if="modelValue.endTime"> - {{ modelValue.endTime }}</template>
        </span>
        <span v-for="(name, index) in modelValue.attendees || []" :key="`${name}-${index}`" class="rounded-full bg-canvas px-2 py-1 text-[10px]">
          {{ name }}
        </span>
      </div>
      <pre
        v-if="modelValue.content"
        data-content="read"
        class="mt-6 whitespace-pre-wrap font-sans text-sm leading-7 text-secondary"
      >{{ modelValue.content }}</pre>
      <p v-else data-content="read" class="mt-8 text-sm text-muted">暂无会议内容</p>
    </template>
  </article>
</template>
