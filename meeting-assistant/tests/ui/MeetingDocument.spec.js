import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeetingDocument from '@/components/MeetingDocument.vue'
import MeetingEditorToolbar from '@/components/MeetingEditorToolbar.vue'

const meeting = {
  id: 'meeting-1',
  title: '第三季度产品规划会',
  date: '2026-07-13',
  startTime: '09:30',
  endTime: '11:00',
  attendees: ['李明', '王瑜'],
  content: '## 会议议题\n\n讨论产品优先级。'
}

describe('MeetingDocument', () => {
  it('emits complete meeting objects as editable fields change', async () => {
    const wrapper = mount(MeetingDocument, {
      props: { modelValue: meeting, mode: 'edit' }
    })

    expect(wrapper.get('[data-field="title"]').element.value).toBe('第三季度产品规划会')
    expect(wrapper.get('[data-field="summary"]').element.value).toContain('会议议题')

    await wrapper.get('[data-field="title"]').setValue('更新后的规划会')

    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual({
      ...meeting,
      title: '更新后的规划会'
    })

    await wrapper.get('[data-action="remove-attendee"]').trigger('click')
    expect(wrapper.emitted('remove-attendee')[0]).toEqual([0])
  })

  it('adds an attendee without mutating the meeting prop', async () => {
    const wrapper = mount(MeetingDocument, {
      props: { modelValue: meeting, mode: 'edit' }
    })

    await wrapper.get('[data-field="attendee"]').setValue('陈晨')
    await wrapper.get('[data-field="attendee"]').trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('add-attendee')[0]).toEqual(['陈晨'])
    expect(meeting.attendees).toEqual(['李明', '王瑜'])
  })

  it('renders saved content without form controls in read mode', () => {
    const wrapper = mount(MeetingDocument, {
      props: { modelValue: meeting, mode: 'read', activeSection: 'summary' }
    })

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.get('[data-content="summary"]').text()).toContain('讨论产品优先级')
    expect(wrapper.text()).toContain('李明')
  })

  it('defaults to minutes and switches to the complete transcript', async () => {
    const structuredMeeting = {
      ...meeting,
      summary: '### 会议决定\n继续推进',
      transcript: '[00:00-00:30] 讨论方案'
    }
    const wrapper = mount(MeetingDocument, {
      props: {
        modelValue: structuredMeeting,
        mode: 'edit',
        activeSection: 'summary'
      }
    })

    expect(wrapper.get('[data-field="summary"]').element.value).toContain('继续推进')
    await wrapper.get('[data-section="transcript"]').trigger('click')
    expect(wrapper.emitted('update:activeSection')[0]).toEqual(['transcript'])
  })

  it('emits only the active section content', async () => {
    const structuredMeeting = { ...meeting, summary: '', transcript: '原始转写' }
    const wrapper = mount(MeetingDocument, {
      props: {
        modelValue: structuredMeeting,
        mode: 'edit',
        activeSection: 'transcript'
      }
    })

    await wrapper.get('[data-field="transcript"]').setValue('修正后的转写')
    expect(wrapper.emitted('update:modelValue').at(-1)[0]).toEqual({
      ...structuredMeeting,
      transcript: '修正后的转写'
    })
  })

  it('shows minutes first in read mode and keeps transcript available', () => {
    const wrapper = mount(MeetingDocument, {
      props: {
        modelValue: { ...meeting, summary: '整理结论', transcript: '详细原文' },
        mode: 'read',
        activeSection: 'summary'
      }
    })

    expect(wrapper.get('[data-content="summary"]').text()).toContain('整理结论')
    expect(wrapper.find('[data-content="transcript"]').exists()).toBe(false)
  })

  it('disables organization until a transcript exists', () => {
    const wrapper = mount(MeetingDocument, {
      props: {
        modelValue: { ...meeting, summary: '', transcript: '' },
        mode: 'edit',
        activeSection: 'summary'
      }
    })

    expect(wrapper.get('[data-action="organize-empty"]').attributes('disabled')).toBeDefined()
  })

  it('does not fail when smooth scrolling is unavailable', () => {
    const wrapper = mount(MeetingDocument, {
      props: { modelValue: meeting, mode: 'edit', activeSection: 'summary' }
    })

    expect(() => wrapper.vm.scrollToSectionTop()).not.toThrow()
  })
})

describe('MeetingEditorToolbar', () => {
  it('emits every existing Markdown editing command', async () => {
    const wrapper = mount(MeetingEditorToolbar)
    const commands = [
      'heading',
      'subheading',
      'bold',
      'italic',
      'bullet',
      'numbered',
      'checkbox',
      'quote',
      'code',
      'divider',
      'template'
    ]

    for (const command of commands) {
      await wrapper.get(`[data-command="${command}"]`).trigger('click')
    }

    expect(wrapper.emitted('command').map(event => event[0])).toEqual(commands)
  })
})
