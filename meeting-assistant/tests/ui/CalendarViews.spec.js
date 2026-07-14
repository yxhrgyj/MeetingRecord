import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import DayView from '@/components/DayView.vue'
import MonthView from '@/components/MonthView.vue'
import WeekView from '@/components/WeekView.vue'

const currentDate = new Date(2026, 6, 13)
const meeting = {
  id: 'meeting-1',
  title: '季度目标讨论',
  date: '2026-07-13',
  startTime: '09:30',
  endTime: '10:30',
  attendees: ['李明']
}
const meetingsByDate = { '2026-07-13': [meeting] }

describe('calendar views', () => {
  it('keeps the month grid and meeting selection behavior stable', async () => {
    const wrapper = mount(MonthView, {
      props: { currentDate, meetingsByDate }
    })

    expect(wrapper.findAll('[data-calendar-cell]')).toHaveLength(42)
    expect(wrapper.get('[data-meeting-id="meeting-1"]').text()).toContain('季度目标讨论')

    await wrapper.get('[data-meeting-id="meeting-1"]').trigger('click')

    expect(wrapper.emitted('selectMeeting')[0][0].id).toBe('meeting-1')
  })

  it('keeps day time slots selectable', async () => {
    const wrapper = mount(DayView, {
      props: { currentDate, meetingsByDate }
    })

    await wrapper.get('[data-time-slot="09:00"]').trigger('click')

    expect(wrapper.emitted('selectDate')[0]).toEqual(['2026-07-13'])
    expect(wrapper.get('[data-meeting-id="meeting-1"]').text()).toContain('09:30 - 10:30')
  })

  it('keeps week meetings positioned by minute', () => {
    const wrapper = mount(WeekView, {
      props: { currentDate, meetingsByDate }
    })

    expect(wrapper.get('[data-meeting-id="meeting-1"]').attributes('style')).toContain('top: 570px')
  })
})
