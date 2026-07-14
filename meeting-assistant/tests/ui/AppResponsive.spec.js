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

describe('App responsive defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.fetchMeetings.mockResolvedValue([])
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }))
  })

  it('starts in day view on a mobile viewport', async () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          CalendarView: {
            props: ['view'],
            template: '<div data-test="calendar-view">{{ view }}</div>'
          }
        }
      }
    })
    await flushPromises()

    expect(wrapper.get('[data-view="day"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-test="calendar-view"]').text()).toBe('day')

    wrapper.unmount()
  })
})
