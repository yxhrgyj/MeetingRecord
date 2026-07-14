<script setup>
import { computed, ref } from 'vue'
import MeetingDocument from '@/components/MeetingDocument.vue'
import MeetingInfoPanel from '@/components/MeetingInfoPanel.vue'
import MeetingWorkspace from '@/components/MeetingWorkspace.vue'
import MeetingWorkspaceHeader from '@/components/MeetingWorkspaceHeader.vue'
import { parseMeetingContent } from '@/domain/meetingContent.js'

const props = defineProps({
  meeting: { type: Object, required: true }
})

const emit = defineEmits(['edit', 'delete', 'export', 'close'])
const assistantOpen = ref(false)
const activeSection = ref('summary')
const documentMeeting = computed(() => ({
  ...props.meeting,
  ...parseMeetingContent(props.meeting.content)
}))

function exportMeeting(format) {
  emit('export', props.meeting, format)
}
</script>

<template>
  <MeetingWorkspace
    v-if="meeting"
    mode="read"
    :assistant-open="assistantOpen"
    @update:assistant-open="assistantOpen = $event"
  >
    <template #header>
      <MeetingWorkspaceHeader
        mode="read"
        :can-export="true"
        @close="emit('close')"
        @edit="emit('edit', meeting)"
        @export="exportMeeting('docx')"
        @toggle-assistant="assistantOpen = !assistantOpen"
      />
    </template>

    <template #document>
      <MeetingDocument
        :model-value="documentMeeting"
        mode="read"
        :active-section="activeSection"
        @update:active-section="activeSection = $event"
      />
    </template>

    <template #assistant>
      <MeetingInfoPanel
        :meeting="meeting"
        @export-markdown="exportMeeting('md')"
        @export-docx="exportMeeting('docx')"
        @delete="emit('delete', $event)"
      />
    </template>
  </MeetingWorkspace>
</template>
