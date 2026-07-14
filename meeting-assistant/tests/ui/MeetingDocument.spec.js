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
    expect(wrapper.get('[data-field="content"]').element.value).toContain('会议议题')

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
      props: { modelValue: meeting, mode: 'read' }
    })

    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.get('[data-content="read"]').text()).toContain('讨论产品优先级')
    expect(wrapper.text()).toContain('李明')
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
