import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeetingProcessStatus from '@/components/MeetingProcessStatus.vue'

describe('MeetingProcessStatus', () => {
  it('marks the active phase and exposes text status', () => {
    const wrapper = mount(MeetingProcessStatus, {
      props: { phase: 'transcribe', status: '正在转写第 3 个片段' }
    })

    expect(wrapper.get('[data-phase="record"]').attributes('aria-current')).toBeUndefined()
    expect(wrapper.get('[data-phase="transcribe"]').attributes('aria-current')).toBe('step')
    expect(wrapper.text()).toContain('正在转写第 3 个片段')
  })

  it('renders an actionable error without relying on color', async () => {
    const wrapper = mount(MeetingProcessStatus, {
      props: {
        phase: 'organize',
        status: '模型服务暂不可用',
        tone: 'warning',
        retryable: true
      }
    })

    await wrapper.get('[data-action="retry"]').trigger('click')

    expect(wrapper.get('[role="status"]').attributes('data-tone')).toBe('warning')
    expect(wrapper.text()).toContain('模型服务暂不可用')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })
})
