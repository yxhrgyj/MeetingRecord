import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeetingContentTabs from '@/components/MeetingContentTabs.vue'

describe('MeetingContentTabs', () => {
  it('exposes minutes as the selected default section', () => {
    const wrapper = mount(MeetingContentTabs, {
      props: { modelValue: 'summary' }
    })

    expect(wrapper.get('[role="tablist"]').attributes('aria-label')).toBe('会议内容')
    expect(wrapper.get('[data-section="summary"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-section="transcript"]').attributes('aria-selected')).toBe('false')
  })

  it('emits the selected section', async () => {
    const wrapper = mount(MeetingContentTabs, {
      props: { modelValue: 'summary' }
    })

    await wrapper.get('[data-section="transcript"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['transcript'])
  })
})
