import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MeetingWorkspace from '@/components/MeetingWorkspace.vue'
import MeetingWorkspaceHeader from '@/components/MeetingWorkspaceHeader.vue'

describe('MeetingWorkspace', () => {
  it('keeps document and assistant regions in one shared shell', async () => {
    const wrapper = mount(MeetingWorkspace, {
      props: { mode: 'edit', assistantOpen: false },
      slots: {
        header: '<div>Header</div>',
        document: '<article>Document</article>',
        assistant: '<div>Assistant</div>'
      }
    })

    expect(wrapper.get('[data-region="document"]').text()).toContain('Document')
    const assistant = wrapper.get('[data-region="assistant"]')
    expect(assistant.text()).toContain('Assistant')
    expect(assistant.classes()).toContain('min-[1100px]:translate-x-0')

    await wrapper.get('[data-action="close-assistant"]').trigger('click')

    expect(wrapper.emitted('update:assistantOpen')[0]).toEqual([false])
  })
})

describe('MeetingWorkspaceHeader', () => {
  it('uses Complete as the edit-mode primary action', async () => {
    const wrapper = mount(MeetingWorkspaceHeader, {
      props: { mode: 'edit', saveStatus: '已自动保存 09:42', canExport: true }
    })

    expect(wrapper.get('[data-action="primary"]').text()).toBe('完成')
    expect(wrapper.text()).toContain('已自动保存 09:42')

    await wrapper.get('[data-action="close"]').trigger('click')
    await wrapper.get('[data-action="export"]').trigger('click')
    await wrapper.get('[data-action="primary"]').trigger('click')
    await wrapper.get('[data-action="toggle-assistant"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.emitted('export')).toHaveLength(1)
    expect(wrapper.emitted('complete')).toHaveLength(1)
    expect(wrapper.emitted('toggle-assistant')).toHaveLength(1)
  })

  it('uses Edit as the read-mode primary action', async () => {
    const wrapper = mount(MeetingWorkspaceHeader, {
      props: { mode: 'read', canExport: true }
    })

    expect(wrapper.get('[data-action="primary"]').text()).toBe('编辑')
    await wrapper.get('[data-action="primary"]').trigger('click')
    expect(wrapper.emitted('edit')).toHaveLength(1)
  })
})
