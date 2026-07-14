<script setup>
import { computed, ref } from 'vue'
import { CalendarDays, Clock3, Plus, Users, X } from '@lucide/vue'
import MeetingContentTabs from '@/components/MeetingContentTabs.vue'

const props = defineProps({
  modelValue: { type: Object, required: true },
  mode: { type: String, required: true },
  activeSection: { type: String, default: 'summary' }
})

const emit = defineEmits([
  'update:modelValue',
  'add-attendee',
  'remove-attendee',
  'content-keydown',
  'update:activeSection',
  'organize'
])

const attendeeInput = ref('')
const contentRef = ref(null)
const sectionTopRef = ref(null)

const activeField = computed(() => props.activeSection === 'transcript' ? 'transcript' : 'summary')
const activeContent = computed(() => {
  const structuredValue = props.modelValue[activeField.value]
  if (structuredValue !== undefined) return structuredValue
  return activeField.value === 'summary' ? props.modelValue.content || '' : ''
})

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

function patchActiveContent(value) {
  const usesStructuredSections = 'summary' in props.modelValue || 'transcript' in props.modelValue
  if (usesStructuredSections) patch({ [activeField.value]: value })
  else patch({ content: value })
}

function scrollToSectionTop() {
  sectionTopRef.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
}

defineExpose({ focusContent, getContentElement, scrollToSectionTop })
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

      <div ref="sectionTopRef" data-section-top class="mt-5 flex items-center justify-between gap-3 border-b border-line pb-4">
        <MeetingContentTabs
          :model-value="activeSection"
          @update:model-value="$emit('update:activeSection', $event)"
        />
      </div>

      <div class="sticky top-0 z-10 -mx-2 border-b border-line bg-white/90 px-2 py-2 backdrop-blur-xl">
        <slot name="toolbar"></slot>
      </div>

      <div
        v-if="activeSection === 'summary' && !activeContent"
        class="mt-5 rounded-panel border border-line bg-canvas px-4 py-3 text-xs text-secondary"
      >
        <p>尚未生成会议纪要</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="command-button"
            data-action="organize-empty"
            :disabled="!modelValue.transcript?.trim()"
            @click="$emit('organize')"
          >
            整理会议纪要
          </button>
          <button
            type="button"
            class="btn-ghost"
            data-action="show-transcript"
            @click="$emit('update:activeSection', 'transcript')"
          >
            查看完整转写
          </button>
        </div>
      </div>

      <textarea
        ref="contentRef"
        :value="activeContent"
        :data-field="activeField"
        :aria-label="activeSection === 'summary' ? '会议纪要' : '完整转写'"
        class="focus-ring mt-5 min-h-[430px] w-full resize-none rounded-control border-0 bg-transparent p-0 text-sm leading-7 text-secondary placeholder:text-black/25"
        :placeholder="activeSection === 'summary' ? '记录会议结论、决定和行动项' : '语音转写将在这里显示，也可手动修正识别结果'"
        @input="patchActiveContent($event.target.value)"
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
      <div ref="sectionTopRef" data-section-top class="mt-5 border-b border-line pb-4">
        <MeetingContentTabs
          :model-value="activeSection"
          @update:model-value="$emit('update:activeSection', $event)"
        />
      </div>
      <pre
        v-if="activeContent"
        :data-content="activeField"
        class="mt-6 whitespace-pre-wrap font-sans text-sm leading-7 text-secondary"
      >{{ activeContent }}</pre>
      <div v-else :data-content="activeField" class="mt-8 text-sm text-muted">
        <p>{{ activeSection === 'summary' ? '该会议尚未整理纪要' : '暂无完整转写' }}</p>
        <button
          v-if="activeSection === 'summary' && modelValue.transcript"
          type="button"
          class="command-button mt-3"
          data-action="show-transcript"
          @click="$emit('update:activeSection', 'transcript')"
        >
          查看完整转写
        </button>
      </div>
    </template>
  </article>
</template>
