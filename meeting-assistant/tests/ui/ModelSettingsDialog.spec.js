import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import ModelSettingsDialog from '@/components/ModelSettingsDialog.vue'

describe('ModelSettingsDialog', () => {
  it('edits, tests, and saves the gateway URL with accessible status', async () => {
    const wrapper = mount(ModelSettingsDialog, {
      props: {
        modelValue: 'https://model.example.com',
        loading: false,
        saving: false,
        status: '模型服务连接正常'
      },
      attachTo: document.body
    })

    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('true')
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('模型服务连接正常')

    await wrapper.get('[data-field="gateway-url"]').setValue('https://new.example.com')
    await wrapper.get('[data-action="test"]').trigger('click')
    await wrapper.get('[data-action="save"]').trigger('click')

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual(['https://new.example.com'])
    expect(wrapper.emitted('test')).toHaveLength(1)
    expect(wrapper.emitted('save')[0]).toEqual(['https://new.example.com'])
  })

  it('closes with Escape', async () => {
    const wrapper = mount(ModelSettingsDialog, {
      props: { modelValue: '', status: '' },
      attachTo: document.body
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
