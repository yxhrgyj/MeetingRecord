import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MeetingEditor from '@/components/MeetingEditor.vue'

const clients = vi.hoisted(() => ({
  transcribeAudio: vi.fn(),
  summarizeContent: vi.fn(),
  createMeeting: vi.fn(),
  updateMeeting: vi.fn(),
  checkHealth: vi.fn(),
  startRecording: vi.fn(),
  uploadChunk: vi.fn(),
  finishRecording: vi.fn()
}))

vi.mock('@/composables/useApi.js', () => ({
  useApi: () => ({
    createMeeting: clients.createMeeting,
    updateMeeting: clients.updateMeeting
  })
}))

vi.mock('@/composables/useAsr.js', () => ({
  useAsr: () => ({ transcribeAudio: clients.transcribeAudio }),
  formatTranscriptForEditor: () => '转写结果'
}))

vi.mock('@/composables/useLocalRecording.js', () => ({
  useLocalRecording: () => ({
    checkHealth: clients.checkHealth,
    startRecording: clients.startRecording,
    uploadChunk: clients.uploadChunk,
    finishRecording: clients.finishRecording
  })
}))

vi.mock('@/composables/useSummarizer.js', () => ({
  useSummarizer: () => ({ summarizeContent: clients.summarizeContent })
}))

const initialData = {
  id: 'meeting-1',
  title: '原会议',
  date: '2026-07-13',
  startTime: '09:30',
  endTime: '10:30',
  attendees: [],
  content: [
    '## 会议纪要',
    '',
    '原始纪要',
    '',
    '---',
    '',
    '## 完整转写',
    '',
    '原始转写内容'
  ].join('\n')
}

describe('MeetingEditor integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clients.transcribeAudio.mockResolvedValue({ text: '转写结果' })
    clients.summarizeContent.mockResolvedValue({ summary: '确认三项行动。' })
  })

  it('renders the workspace and completes with a cloned meeting payload', async () => {
    const wrapper = mount(MeetingEditor, { props: { initialData } })

    expect(wrapper.get('[data-region="document"]').exists()).toBe(true)
    expect(wrapper.get('[data-region="assistant"]').exists()).toBe(true)

    await wrapper.get('[data-field="title"]').setValue('第三季度产品规划会')
    await wrapper.get('[data-action="primary"]').trigger('click')

    expect(wrapper.emitted('save')[0][0]).toMatchObject({
      id: 'meeting-1',
      title: '第三季度产品规划会',
      attendees: []
    })
    expect(wrapper.emitted('save')[0][0]).not.toBe(initialData)
    const saved = wrapper.emitted('save')[0][0]
    expect(saved.content).toContain('## 会议纪要')
    expect(saved.content).toContain('## 完整转写')
    expect(saved).not.toHaveProperty('summary')
    expect(saved).not.toHaveProperty('transcript')

    wrapper.unmount()
  })

  it('keeps transcript and minutes separate across ASR and summarization', async () => {
    const wrapper = mount(MeetingEditor, { props: { initialData } })
    await nextTick()

    expect(wrapper.get('[data-section="summary"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-field="summary"]').element.value).toContain('原始纪要')

    await wrapper.get('[data-section="transcript"]').trigger('click')

    const fileInput = wrapper.get('input[type="file"]')
    const audio = new File(['audio'], 'meeting.wav', { type: 'audio/wav' })
    Object.defineProperty(fileInput.element, 'files', { configurable: true, value: [audio] })
    await fileInput.trigger('change')
    await flushPromises()

    expect(clients.transcribeAudio).toHaveBeenCalledWith(audio)
    expect(wrapper.get('[data-field="transcript"]').element.value).toContain('转写结果')

    await wrapper.get('[data-action="summarize"]').trigger('click')
    await flushPromises()

    expect(clients.summarizeContent).toHaveBeenCalledWith(expect.stringContaining('原始转写内容'))
    expect(clients.summarizeContent.mock.calls[0][0]).not.toContain('原始纪要')
    expect(wrapper.get('[data-section="summary"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-field="summary"]').element.value).toContain('确认三项行动')

    await wrapper.get('[data-section="transcript"]').trigger('click')
    expect(wrapper.get('[data-field="transcript"]').element.value).toContain('转写结果')

    wrapper.unmount()
  })

  it('exports a cloned saved meeting with the requested format', async () => {
    const wrapper = mount(MeetingEditor, { props: { initialData } })
    await nextTick()

    await wrapper.get('[data-action="export-markdown"]').trigger('click')

    expect(wrapper.emitted('export')[0][0]).toEqual(initialData)
    expect(wrapper.emitted('export')[0][0]).not.toBe(initialData)
    expect(wrapper.emitted('export')[0][1]).toBe('md')

    wrapper.unmount()
  })
})
