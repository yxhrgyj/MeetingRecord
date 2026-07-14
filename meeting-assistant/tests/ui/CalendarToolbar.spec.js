import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import CalendarToolbar from '@/components/CalendarToolbar.vue'

describe('CalendarToolbar', () => {
  it('emits calendar navigation and creation commands', async () => {
    const wrapper = mount(CalendarToolbar, {
      props: { view: 'month', title: '2026 年 7 月' }
    })

    expect(wrapper.text()).toContain('2026 年 7 月')
    expect(wrapper.get('[data-view="month"]').attributes('aria-pressed')).toBe('true')

    await wrapper.get('[data-view="week"]').trigger('click')
    await wrapper.get('[aria-label="上一时间段"]').trigger('click')
    await wrapper.get('[data-action="today"]').trigger('click')
    expect(wrapper.get('[data-action="create"]').attributes('aria-label')).toBe('新建会议')
    await wrapper.get('[data-action="create"]').trigger('click')

    expect(wrapper.emitted('update:view')[0]).toEqual(['week'])
    expect(wrapper.emitted('navigate')[0]).toEqual([-1])
    expect(wrapper.emitted('today')).toHaveLength(1)
    expect(wrapper.emitted('create')).toHaveLength(1)
  })

  it('moves low-frequency actions into an overflow menu', async () => {
    const wrapper = mount(CalendarToolbar, {
      props: { view: 'month', title: '2026 年 7 月' },
      attachTo: document.body
    })

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    await wrapper.get('[aria-label="更多操作"]').trigger('click')
    expect(wrapper.get('[aria-label="更多操作"]').attributes('aria-expanded')).toBe('true')

    await wrapper.get('[data-action="model-settings"]').trigger('click')
    expect(wrapper.emitted('model-settings')).toHaveLength(1)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)

    await wrapper.get('[aria-label="更多操作"]').trigger('click')
    await wrapper.get('[data-action="export-month"]').trigger('click')
    expect(wrapper.emitted('export-month')).toHaveLength(1)
  })

  it('closes the overflow menu with Escape', async () => {
    const wrapper = mount(CalendarToolbar, {
      props: { view: 'month', title: '2026 年 7 月' },
      attachTo: document.body
    })

    await wrapper.get('[aria-label="更多操作"]').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })
})
