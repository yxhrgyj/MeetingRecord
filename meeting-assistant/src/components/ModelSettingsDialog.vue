<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Save, Wifi, X } from '@lucide/vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  loading: Boolean,
  saving: Boolean,
  status: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'close', 'test', 'save'])
const gatewayUrl = ref(props.modelValue)
const dialogRef = ref(null)
const inputRef = ref(null)

watch(() => props.modelValue, value => {
  gatewayUrl.value = value
})

function updateUrl(value) {
  gatewayUrl.value = value
  emit('update:modelValue', value)
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab') return

  const controls = [...(dialogRef.value?.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  ) || [])]
  if (!controls.length) return
  const first = controls[0]
  const last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleDocumentKeydown)
  nextTick(() => inputRef.value?.focus())
})

onUnmounted(() => document.removeEventListener('keydown', handleDocumentKeydown))
</script>

<template>
  <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm" @click.self="$emit('close')">
    <section
      ref="dialogRef"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-settings-title"
      class="w-full max-w-lg overflow-hidden rounded-panel border border-line bg-surface shadow-2xl"
    >
      <header class="flex h-14 items-center justify-between border-b border-line px-5">
        <div>
          <h2 id="model-settings-title" class="text-[13px] font-semibold text-ink">模型服务</h2>
          <p class="mt-0.5 text-[10px] text-muted">会议转写与纪要通过此网关连接本机服务。</p>
        </div>
        <button type="button" data-action="close" class="icon-button" aria-label="关闭模型设置" @click="$emit('close')">
          <X :size="17" />
        </button>
      </header>

      <div class="px-5 py-5">
        <label class="block">
          <span class="mb-1.5 block text-[11px] font-medium text-secondary">Gateway URL</span>
          <input
            ref="inputRef"
            :value="gatewayUrl"
            type="url"
            data-field="gateway-url"
            class="input-field"
            placeholder="https://model.example.com"
            :disabled="loading"
            @input="updateUrl($event.target.value)"
          />
        </label>
        <div aria-live="polite" role="status" class="mt-3 min-h-5 text-[11px] text-secondary">
          {{ status }}
        </div>
      </div>

      <footer class="flex items-center justify-end gap-2 border-t border-line px-5 py-4">
        <button type="button" data-action="test" class="command-button" :disabled="saving || loading" @click="$emit('test')">
          <Wifi :size="14" />
          测试连接
        </button>
        <button type="button" data-action="save" class="btn-primary h-8 px-3 text-xs" :disabled="saving || loading" @click="$emit('save', gatewayUrl)">
          <Save :size="14" />
          保存
        </button>
      </footer>
    </section>
  </div>
</template>
