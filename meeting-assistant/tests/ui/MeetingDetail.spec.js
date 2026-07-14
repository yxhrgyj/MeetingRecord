import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeetingDetail from '@/components/MeetingDetail.vue'

const meeting = {
  id: 'meeting-1',
  title: '第三季度产品规划会',
  date: '2026-07-13',
  startTime: '09:30',
  endTime: '11:00',
  attendees: ['李明', '王瑜'],
  content: '## 会议决定\n\n统一使用 Qwen3 8B。',
  createdAt: '2026-07-13T01:20:00.000Z',
  updatedAt: '2026-07-13T03:04:00.000Z'
}

describe('MeetingDetail', () => {
  it('renders the saved meeting in the shared read workspace', () => {
    const wrapper = mount(MeetingDetail, { props: { meeting } })

    expect(wrapper.get('[data-region="document"]').text()).toContain('第三季度产品规划会')
    expect(wrapper.get('[data-content="summary"]').text()).toContain('统一使用 Qwen3 8B')
    expect(wrapper.get('[data-region="assistant"]').text()).toContain('已整理')
    expect(wrapper.text()).toContain('李明')
  })

  it('forwards navigation, edit, export, and delete commands', async () => {
    const wrapper = mount(MeetingDetail, { props: { meeting } })

    await wrapper.get('[data-action="close"]').trigger('click')
    await wrapper.get('[data-action="primary"]').trigger('click')
    await wrapper.get('[data-action="export-markdown"]').trigger('click')
    await wrapper.get('[data-action="export-docx"]').trigger('click')
    await wrapper.get('[data-action="delete"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('edit')[0]).toEqual([meeting])
    expect(wrapper.emitted('export')[0]).toEqual([meeting, 'md'])
    expect(wrapper.emitted('export')[1]).toEqual([meeting, 'docx'])
    expect(wrapper.emitted('delete')[0]).toEqual(['meeting-1'])
  })
})
