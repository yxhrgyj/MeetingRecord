import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.vue'

const api = vi.hoisted(() => ({
  fetchMeetings: vi.fn(),
  exportMeeting: vi.fn(),
  exportMonth: vi.fn(),
  createMeeting: vi.fn(),
  updateMeeting: vi.fn(),
  deleteMeeting: vi.fn(),
  getModelGatewaySettings: vi.fn(),
  updateModelGatewaySettings: vi.fn(),
  testModelGateway: vi.fn()
}))

vi.mock('@/composables/useApi.js', () => ({ useApi: () => api }))

describe('App meeting editor wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.fetchMeetings.mockResolvedValue([])
    api.exportMeeting.mockResolvedValue(new Blob(['minutes']))
    URL.createObjectURL = vi.fn(() => 'blob:meeting')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('forwards the editor export format to the meeting API', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          CalendarView: true,
          MeetingEditor: {
            emits: ['export'],
            template: `<button data-test="editor-export" @click="$emit('export', { id: 'meeting-1', title: '规划会', date: '2026-07-13' }, 'md')">Export</button>`
          }
        }
      }
    })
    await flushPromises()

    await wrapper.get('[data-action="create"]').trigger('click')
    await wrapper.get('[data-test="editor-export"]').trigger('click')
    await flushPromises()

    expect(api.exportMeeting).toHaveBeenCalledWith('meeting-1', 'md')

    wrapper.unmount()
  })
})
