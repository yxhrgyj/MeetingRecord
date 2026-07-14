<script setup>
import {
  Braces,
  FileText,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote
} from '@lucide/vue'

defineEmits(['command'])
</script>

<template>
  <div class="flex flex-wrap items-center gap-0.5" aria-label="正文格式工具栏">
    <button type="button" data-command="heading" class="icon-button text-[11px] font-semibold" aria-label="二级标题" title="二级标题" @click="$emit('command', 'heading')">H2</button>
    <button type="button" data-command="subheading" class="icon-button text-[11px] font-semibold" aria-label="三级标题" title="三级标题" @click="$emit('command', 'subheading')">H3</button>
    <span class="mx-1 h-4 w-px bg-line" aria-hidden="true"></span>
    <button type="button" data-command="bold" class="icon-button text-xs font-bold" aria-label="加粗" title="加粗" @click="$emit('command', 'bold')">B</button>
    <button type="button" data-command="italic" class="icon-button font-serif text-sm italic" aria-label="斜体" title="斜体" @click="$emit('command', 'italic')">I</button>
    <span class="mx-1 h-4 w-px bg-line" aria-hidden="true"></span>
    <button type="button" data-command="bullet" class="icon-button" aria-label="无序列表" title="无序列表" @click="$emit('command', 'bullet')"><List :size="15" /></button>
    <button type="button" data-command="numbered" class="icon-button" aria-label="有序列表" title="有序列表" @click="$emit('command', 'numbered')"><ListOrdered :size="15" /></button>
    <button type="button" data-command="checkbox" class="icon-button" aria-label="待办事项" title="待办事项" @click="$emit('command', 'checkbox')"><ListChecks :size="15" /></button>
    <button type="button" data-command="quote" class="icon-button" aria-label="引用" title="引用" @click="$emit('command', 'quote')"><Quote :size="15" /></button>
    <button type="button" data-command="code" class="icon-button" aria-label="代码块" title="代码块" @click="$emit('command', 'code')"><Braces :size="15" /></button>
    <button type="button" data-command="divider" class="icon-button" aria-label="分隔线" title="分隔线" @click="$emit('command', 'divider')"><Minus :size="15" /></button>
    <span class="mx-1 h-4 w-px bg-line" aria-hidden="true"></span>
    <button type="button" data-command="template" class="focus-ring inline-flex h-8 items-center gap-1.5 rounded-control px-2 text-[11px] font-medium text-primary-600 hover:bg-primary-50" aria-label="插入会议模板" title="插入会议模板" @click="$emit('command', 'template')">
      <FileText :size="14" />
      <span class="hidden sm:inline">会议模板</span>
    </button>
  </div>
</template>
