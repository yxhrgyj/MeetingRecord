import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MeetingEditor from '@/components/MeetingEditor.vue'

const clients = vi.hoisted(() => ({
  transcribeAudio: vi.fn(),
  transcribeUploadedAudio: vi.fn(),
  summarizeContent: vi.fn(),
  createMeeting: vi.fn(),
  updateMeeting: vi.fn(),
  checkHealth: vi.fn(),
  startRecording: vi.fn(),
  uploadChunk: vi.fn(),
  finishRecording: vi.fn(),
  queueRecording: vi.fn(),
  waitForRecording: vi.fn(),
  listRecordingJobs: vi.fn(),
  retryRecording: vi.fn(),
  summarizeLongMeeting: vi.fn()
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
    finishRecording: clients.finishRecording,
    queueRecording: clients.queueRecording,
    waitForRecording: clients.waitForRecording,
    transcribeUploadedAudio: clients.transcribeUploadedAudio,
    listRecordingJobs: clients.listRecordingJobs,
    retryRecording: clients.retryRecording
  })
}))

vi.mock('@/composables/useSummarizer.js', () => ({
  useSummarizer: () => ({
    summarizeContent: clients.summarizeContent,
    summarizeLongMeeting: clients.summarizeLongMeeting
  })
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
    clients.checkHealth.mockResolvedValue({ ok: true })
    clients.startRecording.mockResolvedValue({ id: 'recording-1' })
    clients.uploadChunk.mockResolvedValue({ index: 0 })
    clients.queueRecording.mockResolvedValue({ id: 'recording-1', status: 'processing' })
    clients.waitForRecording.mockResolvedValue({ transcript: '分段转写结果' })
    clients.transcribeAudio.mockResolvedValue({ text: '转写结果' })
    clients.transcribeUploadedAudio.mockResolvedValue({ transcript: '转写结果' })
    clients.listRecordingJobs.mockResolvedValue([])
    clients.retryRecording.mockResolvedValue({ id: 'old-job', status: 'queued' })
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

    expect(clients.transcribeUploadedAudio).toHaveBeenCalledWith(
      audio,
      expect.objectContaining({ title: '原会议' }),
      expect.any(Object)
    )
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

  it('starts the next recording while the previous segment is still processing', async () => {
    const previousMediaDevices = navigator.mediaDevices
    const previousMediaRecorder = window.MediaRecorder
    class FakeMediaRecorder {
      static isTypeSupported() { return true }

      constructor() {
        this.state = 'inactive'
      }

      start() { this.state = 'recording' }

      stop() {
        this.state = 'inactive'
        this.onstop?.()
      }
    }
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) }
    })
    window.MediaRecorder = FakeMediaRecorder

    let releaseFirstSegment
    clients.waitForRecording.mockImplementationOnce(() => new Promise(resolve => {
      releaseFirstSegment = resolve
    }))

    const wrapper = mount(MeetingEditor, { props: { initialData } })
    await wrapper.get('[data-action="record-toggle"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-action="record-toggle"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('第 1 段')
    expect(wrapper.text()).toContain('转写中')

    await wrapper.get('[data-action="record-toggle"]').trigger('click')
    await flushPromises()
    expect(clients.startRecording).toHaveBeenCalledTimes(2)

    releaseFirstSegment({ transcript: 'first' })
    wrapper.unmount()
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: previousMediaDevices })
    window.MediaRecorder = previousMediaRecorder
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
