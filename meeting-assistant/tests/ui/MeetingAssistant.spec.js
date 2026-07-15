import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeetingAssistant from '@/components/MeetingAssistant.vue'

describe('MeetingAssistant', () => {
  it('keeps AI organization disabled until content exists', () => {
    const wrapper = mount(MeetingAssistant, {
      props: { hasContent: false, canExport: false }
    })

    expect(wrapper.get('[data-action="record-toggle"]').text()).toContain('开始会议录音')
    expect(wrapper.get('[data-action="summarize"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-action="export-docx"]').attributes('disabled')).toBeDefined()
  })

  it('shows recording duration and disables conflicting actions', async () => {
    const wrapper = mount(MeetingAssistant, {
      props: {
        isRecording: true,
        recordingSeconds: 1122,
        recordingStatus: '录音中 18:42',
        hasContent: true,
        canExport: true
      }
    })

    expect(wrapper.get('[data-action="record-toggle"]').text()).toContain('结束会议录音')
    expect(wrapper.text()).toContain('18:42')
    expect(wrapper.get('[data-action="upload"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-action="summarize"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-action="record-toggle"]').trigger('click')
    expect(wrapper.emitted('record-toggle')).toHaveLength(1)
  })

  it('emits upload, summarize, and export commands while idle', async () => {
    const wrapper = mount(MeetingAssistant, {
      props: { hasContent: true, canExport: true }
    })

    await wrapper.get('[data-action="upload"]').trigger('click')
    await wrapper.get('[data-action="summarize"]').trigger('click')
    await wrapper.get('[data-action="export-markdown"]').trigger('click')
    await wrapper.get('[data-action="export-docx"]').trigger('click')

    expect(wrapper.emitted('upload')).toHaveLength(1)
    expect(wrapper.emitted('summarize')).toHaveLength(1)
    expect(wrapper.emitted('export-markdown')).toHaveLength(1)
    expect(wrapper.emitted('export-docx')).toHaveLength(1)
  })

  it('only emits retry for an explicitly retryable operation', async () => {
    const wrapper = mount(MeetingAssistant, {
      props: {
        summaryStatus: '模型服务暂不可用',
        retryKind: 'summarize',
        hasContent: true
      }
    })

    await wrapper.get('[data-action="retry"]').trigger('click')

    expect(wrapper.text()).toContain('模型服务暂不可用')
    expect(wrapper.emitted('retry')[0]).toEqual(['summarize'])
  })

  it('shows segment processing and blocks final summary until every segment is complete', () => {
    const wrapper = mount(MeetingAssistant, {
      props: {
        hasContent: true,
        recordingSegments: [
          { index: 0, status: 'completed', transcript: 'first' },
          { index: 1, status: 'processing', transcript: '' }
        ],
        pendingRecordingCount: 1
      }
    })

    expect(wrapper.text()).toContain('第 1 段')
    expect(wrapper.text()).toContain('转写中')
    expect(wrapper.get('[data-action="summarize"]').attributes('disabled')).toBeDefined()
  })

  it('shows persisted failed recordings that can be recovered', async () => {
    const wrapper = mount(MeetingAssistant, {
      props: {
        persistedRecordingJobs: [
          { id: 'old-job', status: 'failed', error: 'Uploaded audio is too large.' }
        ]
      }
    })

    expect(wrapper.get('[data-region="persisted-recordings"]').text()).toContain('old-job')
    await wrapper.get('[data-action="retry-persisted"]').trigger('click')
    expect(wrapper.emitted('retry-persisted')).toEqual([['old-job']])
  })
})
