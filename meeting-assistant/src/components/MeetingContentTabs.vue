<script setup>
defineProps({
  modelValue: {
    type: String,
    default: 'summary',
    validator: value => ['summary', 'transcript'].includes(value)
  }
})

defineEmits(['update:modelValue'])

const sections = [
  { key: 'summary', label: '会议纪要' },
  { key: 'transcript', label: '完整转写' }
]
</script>

<template>
  <div
    role="tablist"
    aria-label="会议内容"
    class="grid w-full grid-cols-2 rounded-panel bg-black/[0.055] p-[3px] sm:w-[260px]"
  >
    <button
      v-for="section in sections"
      :key="section.key"
      type="button"
      role="tab"
      :data-section="section.key"
      :aria-selected="modelValue === section.key"
      class="focus-ring min-h-10 rounded-control px-3 text-xs font-medium transition-colors sm:min-h-8"
      :class="modelValue === section.key ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'"
      @click="$emit('update:modelValue', section.key)"
    >
      {{ section.label }}
    </button>
  </div>
</template>
