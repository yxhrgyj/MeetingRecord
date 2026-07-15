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
  content: [
    '## 会议纪要',
    '',
    '### 会议决定',
    '统一使用 Qwen3 8B。',
    '',
    '---',
    '',
    '## 完整转写',
    '',
    '[00:00-00:30] 讨论模型选择。'
  ].join('\n'),
  createdAt: '2026-07-13T01:20:00.000Z',
  updatedAt: '2026-07-13T03:04:00.000Z'
}

describe('MeetingDetail', () => {
  it('shows minutes first and reveals transcript on demand', async () => {
    const wrapper = mount(MeetingDetail, { props: { meeting } })

    expect(wrapper.get('[data-content="summary"]').text()).toContain('统一使用 Qwen3 8B')
    expect(wrapper.find('[data-content="transcript"]').exists()).toBe(false)

    await wrapper.get('[data-section="transcript"]').trigger('click')
    expect(wrapper.get('[data-content="transcript"]').text()).toContain('讨论模型选择')
  })

  it('moves legacy meeting details into the transcript tab', async () => {
    const legacyMeeting = {
      ...meeting,
      content: [
        '## 会议详情',
        '',
        '[00:00-00:30] 原始讨论内容',
        '',
        '## 整理的纪要',
        '',
        '### 会议决定',
        '- 批准预算'
      ].join('\n')
    }
    const wrapper = mount(MeetingDetail, { props: { meeting: legacyMeeting } })

    expect(wrapper.get('[data-content="summary"]').text()).toContain('批准预算')
    expect(wrapper.get('[data-content="summary"]').text()).not.toContain('原始讨论内容')

    await wrapper.get('[data-section="transcript"]').trigger('click')
    expect(wrapper.get('[data-content="transcript"]').text()).toContain('原始讨论内容')
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
