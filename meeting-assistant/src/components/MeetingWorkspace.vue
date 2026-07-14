<script setup>
import { X } from '@lucide/vue'

defineProps({
  mode: { type: String, required: true },
  assistantOpen: Boolean
})

defineEmits(['update:assistantOpen'])
</script>

<template>
  <div class="flex h-full min-h-0 flex-col bg-canvas" :data-mode="mode">
    <slot name="header"></slot>

    <div class="relative min-h-0 flex-1 overflow-hidden">
      <div class="h-full min-[1100px]:grid min-[1100px]:grid-cols-[minmax(0,1fr)_294px]">
        <main data-region="document" class="h-full min-w-0 overflow-auto px-4 py-5 sm:px-8 sm:py-7">
          <slot name="document"></slot>
        </main>

        <button
          v-if="assistantOpen"
          type="button"
          class="absolute inset-0 z-30 bg-black/20 min-[1100px]:hidden"
          aria-label="关闭会议助手"
          @click="$emit('update:assistantOpen', false)"
        ></button>

        <aside
          data-region="assistant"
          aria-label="会议助手"
          class="fixed inset-x-0 bottom-0 z-40 max-h-[78vh] min-h-[360px] overflow-auto rounded-t-panel border-t border-line bg-white/95 px-5 pb-7 pt-5 shadow-2xl backdrop-blur-xl transition-transform duration-200
                 md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[360px] md:rounded-none md:border-l md:border-t-0
                 min-[1100px]:static min-[1100px]:z-auto min-[1100px]:h-full min-[1100px]:min-h-0 min-[1100px]:w-auto min-[1100px]:translate-x-0 min-[1100px]:translate-y-0 min-[1100px]:border-l min-[1100px]:border-t-0 min-[1100px]:bg-white/75 min-[1100px]:px-[18px] min-[1100px]:shadow-none"
          :class="assistantOpen ? 'translate-y-0 md:translate-x-0' : 'translate-y-full md:translate-x-full md:translate-y-0'"
        >
          <button
            type="button"
            data-action="close-assistant"
            class="icon-button absolute right-3 top-3 min-[1100px]:hidden"
            aria-label="关闭会议助手"
            @click="$emit('update:assistantOpen', false)"
          >
            <X :size="17" />
          </button>
          <slot name="assistant"></slot>
        </aside>
      </div>
    </div>
  </div>
</template>
