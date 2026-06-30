<script setup>
import { reactive, ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useApi } from '@/composables/useApi.js'
import { useDateUtils } from '@/composables/useDateUtils.js'

const props = defineProps({ initialData: Object })
const emit = defineEmits(['save', 'close'])

const dt = useDateUtils()
const api = useApi()

const form = reactive({
  id: '',
  title: '',
  date: dt.formatDate(new Date()),
  startTime: '',
  endTime: '',
  attendees: [],
  content: ''
})

const attendeeInput = ref('')
const contentRef = ref(null)
const autoSaveTimer = ref(null)
const autoSaveLabel = ref('')

function initForm() {
  if (props.initialData) {
    form.id = props.initialData.id || ''
    form.title = props.initialData.title || ''
    form.date = props.initialData.date || dt.formatDate(new Date())
    form.startTime = props.initialData.startTime || ''
    form.endTime = props.initialData.endTime || ''
    form.attendees = [...(props.initialData.attendees || [])]
    form.content = props.initialData.content || ''
  }
}

// ===== 参会人标签 =====
function addAttendee() {
  const name = attendeeInput.value.trim()
  if (name && !form.attendees.includes(name)) {
    form.attendees.push(name)
    attendeeInput.value = ''
  }
}
function removeAttendee(i) { form.attendees.splice(i, 1) }
function onAttendeeKeydown(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    addAttendee()
  }
}

// ===== 快捷记录时间 =====
function recordStartTime() {
  const now = new Date()
  form.startTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
}
function recordEndTime() {
  const now = new Date()
  form.endTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
}

// ===== 快捷插入 =====
function insertAtCursor(before, after = '') {
  const el = contentRef.value
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = form.content.substring(start, end)
  const replacement = before + selected + after
  form.content = form.content.substring(0, start) + replacement + form.content.substring(end)
  nextTick(() => {
    el.focus()
    const pos = start + before.length + selected.length + after.length
    el.setSelectionRange(pos, pos)
  })
}

function insertHeading()    { insertAtCursor('\n## ') }
function insertSubheading() { insertAtCursor('\n### ') }
function insertBold()       { insertAtCursor('**', '**') }
function insertItalic()     { insertAtCursor('*', '*') }
function insertBullet()     { insertAtCursor('\n- ') }
function insertNumbered()   { insertAtCursor('\n1. ') }
function insertCheckbox()   { insertAtCursor('\n- [ ] ') }
function insertDivider()    { insertAtCursor('\n---\n') }
function insertCode()       { insertAtCursor('\n```\n', '\n```\n') }
function insertQuote()      { insertAtCursor('\n> ') }

function insertTemplate() {
  const tpl = `
## 会议议题

1.

## 讨论要点



## 会议决议

1.

## 待办事项

- [ ]  负责人:  截止:
- [ ]  负责人:  截止:

## 备注

`
  insertAtCursor(tpl)
}

// ===== 自动保存（每分钟） =====
function startAutoSave() {
  autoSaveTimer.value = setInterval(doAutoSave, 60000)
}

function stopAutoSave() {
  if (autoSaveTimer.value) {
    clearInterval(autoSaveTimer.value)
    autoSaveTimer.value = null
  }
}

async function doAutoSave() {
  // 没有任何实质内容时不保存
  if (!form.title.trim() && !form.content.trim()) return

  const prevLabel = autoSaveLabel.value
  autoSaveLabel.value = '保存中…'
  try {
    const payload = { ...form, attendees: [...form.attendees] }
    if (form.id) {
      await api.updateMeeting(form.id, payload)
    } else {
      const result = await api.createMeeting(payload)
      form.id = result.id
    }
    const ts = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    autoSaveLabel.value = `已自动保存 ${ts}`
    setTimeout(() => {
      if (autoSaveLabel.value === `已自动保存 ${ts}`) autoSaveLabel.value = ''
    }, 3000)
  } catch (e) {
    console.error('自动保存失败:', e)
    autoSaveLabel.value = '自动保存失败'
    setTimeout(() => {
      if (autoSaveLabel.value === '自动保存失败') autoSaveLabel.value = prevLabel
    }, 3000)
  }
}

// ===== 手动保存并返回 =====
function handleSubmit() {
  if (!form.title.trim()) {
    alert('请输入会议标题')
    return
  }
  emit('save', { ...form, attendees: [...form.attendees] })
}

// ===== 向上查找列表祖先（用于 Shift+Enter 软换行后仍能续号）=====
function findListAncestor(text) {
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]
    const num = l.match(/^(\d+)\.\s+.+$/)
    if (num) return { type: 'number', next: parseInt(num[1]) + 1 }
    const chk = l.match(/^-\s*\[[ x]\]\s+.+$/)
    if (chk) return { type: 'checkbox' }
    const bul = l.match(/^-\s+.+$/)
    if (bul) return { type: 'bullet' }
    // 遇到空行说明不在同一个列表块内
    if (l.trim() === '') break
  }
  return null
}

// ===== 插入新编号行后，将后续编号全部 +1 =====
// 从 startNum 开始，对后续所有编号行进行顺序重编号（而非简单 +1），避免重复累计
function renumberAfter(text, startNum) {
  const lines = text.split('\n')
  let counter = startNum
  let started = false
  for (let i = 0; i < lines.length; i++) {
    if (!started && lines[i].trim() === '') continue // 跳过开头空行
    started = true
    if (lines[i].trim() === '') break // 列表内部空行才停止
    if (/^\d+\.\s/.test(lines[i])) {
      lines[i] = lines[i].replace(/^\d+\.\s/, counter + '. ')
      counter++
    }
  }
  return lines.join('\n')
}

// ===== 回车自动续号 =====
function handleEnterKey(e) {
  const el = contentRef.value
  if (!el) return

  const pos = el.selectionStart
  const beforeCursor = form.content.substring(0, pos)
  const afterCursor = form.content.substring(pos)
  const lastNewline = beforeCursor.lastIndexOf('\n')
  const line = beforeCursor.substring(lastNewline + 1)

  // 编号列表: "1. 内容" 或 "1. "
  const numMatch = line.match(/^(\d+)\.\s+(.+)$/)
  const emptyNumMatch = line.match(/^(\d+)\.\s*$/)
  // 待办: "- [ ] 内容" 或 "- [x] 内容"
  const chkMatch = line.match(/^-\s*\[([ x])\]\s+(.+)$/)
  const emptyChkMatch = line.match(/^-\s*\[([ x])\]\s*$/)
  // 无序列表: "- 内容" 或 "- "
  const bulMatch = line.match(/^-\s+(.+)$/)
  const emptyBulMatch = line.match(/^-\s*$/)

  if (numMatch) {
    e.preventDefault()
    const next = parseInt(numMatch[1]) + 1
    const renumbered = renumberAfter(afterCursor, next + 1)
    form.content = beforeCursor + '\n' + next + '. ' + renumbered
    nextTick(() => {
      el.focus()
      // pos + 1(\n) + next.length + 2(". ") = 新编号行末尾
      el.setSelectionRange(pos + 1 + String(next).length + 2, pos + 1 + String(next).length + 2)
    })
    return
  }
  if (emptyNumMatch) {
    e.preventDefault()
    form.content = beforeCursor.substring(0, lastNewline + 1) + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(lastNewline + 1, lastNewline + 1)
    })
    return
  }
  if (chkMatch) {
    e.preventDefault()
    form.content = beforeCursor + '\n- [ ] ' + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(pos + 7, pos + 7)
    })
    return
  }
  if (emptyChkMatch) {
    e.preventDefault()
    form.content = beforeCursor.substring(0, lastNewline + 1) + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(lastNewline + 1, lastNewline + 1)
    })
    return
  }
  if (bulMatch) {
    e.preventDefault()
    form.content = beforeCursor + '\n- ' + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(pos + 3, pos + 3)
    })
    return
  }
  if (emptyBulMatch) {
    e.preventDefault()
    form.content = beforeCursor.substring(0, lastNewline + 1) + afterCursor
    nextTick(() => {
      el.focus()
      el.setSelectionRange(lastNewline + 1, lastNewline + 1)
    })
    return
  }

  // 当前行不匹配任何列表标记，但可能在列表内部（Shift+Enter 软换行后）
  if (line.trim() === '') return // 空行，不做特殊处理

  const ancestor = findListAncestor(beforeCursor)
  if (!ancestor) return // 无列表祖先，普通回车

  e.preventDefault()
  if (ancestor.type === 'number') {
    const renumbered = renumberAfter(afterCursor, ancestor.next + 1)
    form.content = beforeCursor + '\n' + ancestor.next + '. ' + renumbered
    nextTick(() => {
      el.focus()
      // pos + 1(\n) + next.length + 2(". ") = 新编号行末尾
      el.setSelectionRange(pos + 1 + String(ancestor.next).length + 2, pos + 1 + String(ancestor.next).length + 2)
    })
  } else if (ancestor.type === 'checkbox') {
    form.content = beforeCursor + '\n- [ ] ' + afterCursor
    nextTick(() => { el.focus(); el.setSelectionRange(pos + 7, pos + 7) })
  } else if (ancestor.type === 'bullet') {
    form.content = beforeCursor + '\n- ' + afterCursor
    nextTick(() => { el.focus(); el.setSelectionRange(pos + 3, pos + 3) })
  }
}

// ===== 快捷键 =====
function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    handleSubmit()
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    insertAtCursor('  ')
    return
  }
  if (e.key === 'Enter') {
    // Shift+Enter：软换行，保持缩进与上一行文字对齐
    if (e.shiftKey) {
      e.preventDefault()
      const el = contentRef.value
      if (!el) return
      const pos = el.selectionStart
      const before = form.content.substring(0, pos)
      const lastNL = before.lastIndexOf('\n')
      const curLine = before.substring(lastNL + 1)

      // 计算缩进：优先沿用当前行的前导空格，否则按列表标记宽度计算
      let indent = ''
      const leadingSpace = curLine.match(/^(\s+)/)
      if (leadingSpace) {
        indent = leadingSpace[1]
      } else {
        const nm = curLine.match(/^(\d+\.\s+)/)
        const cm = curLine.match(/^(-\s*\[[ x]\]\s+)/)
        const bm = curLine.match(/^(-\s+)/)
        if (nm) indent = ' '.repeat(nm[1].length)
        else if (cm) indent = ' '.repeat(cm[1].length)
        else if (bm) indent = ' '.repeat(bm[1].length)
      }

      form.content = before + '\n' + indent + form.content.substring(pos)
      nextTick(() => {
        el.focus()
        el.setSelectionRange(pos + 1 + indent.length, pos + 1 + indent.length)
      })
      return
    }
    handleEnterKey(e)
  }
}

onMounted(() => {
  initForm()
  startAutoSave()
  nextTick(() => contentRef.value?.focus())
})

onUnmounted(() => {
  stopAutoSave()
})
</script>

<template>
  <!-- 顶部栏 -->
  <header class="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white">
    <div class="flex items-center gap-4 min-w-0">
      <button @click="emit('close')" class="btn-ghost text-slate-500 flex-shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
      </button>
      <input
        v-model="form.title"
        type="text"
        class="text-lg font-semibold text-slate-800 bg-transparent border-none outline-none placeholder-slate-300 flex-1 min-w-0"
        placeholder="输入会议标题..."
      />
    </div>
    <div class="flex items-center gap-3 flex-shrink-0">
      <span
        v-if="autoSaveLabel"
        class="text-[11px] transition-all duration-300"
        :class="autoSaveLabel.includes('失败') ? 'text-red-400' : 'text-emerald-500'"
      >{{ autoSaveLabel }}</span>
      <button @click="handleSubmit" class="btn-primary text-sm">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        保存并返回
      </button>
    </div>
  </header>

  <!-- 元信息栏 -->
  <div class="flex-shrink-0 px-6 py-3 border-b border-slate-50 bg-slate-50/50">
    <div class="flex items-center gap-4 flex-wrap">
      <div class="flex items-center gap-1.5 text-sm text-slate-500">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
        <input v-model="form.date" type="date" class="bg-transparent border-none outline-none text-slate-600 text-sm w-32" />
      </div>
      <div class="flex items-center gap-1 text-sm text-slate-500">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <input v-model="form.startTime" type="time" class="bg-transparent border-none outline-none text-slate-600 text-sm w-24" placeholder="开始" />
        <button @click="recordStartTime" type="button" class="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-white hover:text-primary-600 hover:border-primary-300 transition-colors" title="记录当前时间为开始时间">开始</button>
        <span class="text-slate-300">-</span>
        <input v-model="form.endTime" type="time" class="bg-transparent border-none outline-none text-slate-600 text-sm w-24" placeholder="结束" />
        <button @click="recordEndTime" type="button" class="text-[10px] px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-white hover:text-primary-600 hover:border-primary-300 transition-colors" title="记录当前时间为结束时间">结束</button>
      </div>
      <div class="h-4 w-px bg-slate-200"></div>
      <div class="flex items-center gap-1.5 flex-wrap">
        <span
          v-for="(name, i) in form.attendees" :key="i"
          class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-white border border-slate-200 text-slate-600"
        >{{ name }}<button @click="removeAttendee(i)" class="text-slate-300 hover:text-red-400">&times;</button></span>
        <input
          v-model="attendeeInput"
          @keydown="onAttendeeKeydown" @blur="addAttendee"
          type="text"
          class="bg-transparent border-none outline-none text-sm text-slate-400 placeholder-slate-300 w-24"
          placeholder="+ 参会人"
        />
      </div>
    </div>
  </div>

  <!-- 快捷工具栏 -->
  <div class="flex-shrink-0 flex items-center gap-0.5 px-6 py-2 border-b border-slate-50 bg-white">
    <button @click="insertHeading" class="btn-ghost text-xs px-2 py-1 font-mono" title="二级标题">H2</button>
    <button @click="insertSubheading" class="btn-ghost text-xs px-2 py-1 font-mono" title="三级标题">H3</button>
    <div class="w-px h-4 bg-slate-200 mx-1"></div>
    <button @click="insertBold" class="btn-ghost text-xs px-2 py-1 font-bold" title="加粗">B</button>
    <button @click="insertItalic" class="btn-ghost text-xs px-2 py-1 italic" title="斜体">I</button>
    <div class="w-px h-4 bg-slate-200 mx-1"></div>
    <button @click="insertNumbered" class="btn-ghost text-xs px-2 py-1" title="有序列表">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h12M7 12h12M7 16h12M4 8h.01M4 12h.01M4 16h.01"/></svg>
    </button>
    <button @click="insertBullet" class="btn-ghost text-xs px-2 py-1" title="无序列表">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/></svg>
    </button>
    <button @click="insertCheckbox" class="btn-ghost text-xs px-2 py-1" title="待办勾选框">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
    </button>
    <button @click="insertQuote" class="btn-ghost text-xs px-2 py-1" title="引用">❝</button>
    <button @click="insertCode" class="btn-ghost text-xs px-2 py-1 font-mono" title="代码块">&lt;/&gt;</button>
    <button @click="insertDivider" class="btn-ghost text-xs px-2 py-1" title="分隔线">—</button>
    <div class="w-px h-4 bg-slate-200 mx-1"></div>
    <button @click="insertTemplate" class="btn-ghost text-xs px-2 py-1 text-primary-500 font-medium" title="插入会议模板">
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      会议模板
    </button>
    <div class="ml-auto flex items-center gap-3 text-[10px] text-slate-300">
      <span>每分钟自动保存</span>
      <span>Enter 续号 · Shift+Enter 换行 · Ctrl+S 保存</span>
    </div>
  </div>

  <!-- 自由书写区 -->
  <div class="flex-1 overflow-hidden">
    <textarea
      ref="contentRef"
      v-model="form.content"
      @keydown="onKeydown"
      class="w-full h-full px-8 py-6 text-sm text-slate-700 leading-relaxed
             bg-white border-none outline-none resize-none
             placeholder-slate-300 font-mono"
      placeholder="在此自由书写会议纪要…

使用上方工具栏插入格式，或点击「会议模板」一键生成结构。

每分钟自动保存，无需担心内容丢失。"
    ></textarea>
  </div>
</template>
