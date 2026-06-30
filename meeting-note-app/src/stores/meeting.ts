import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Meeting, MeetingType, ActionItem } from '@/types'
import { supabase } from '@/db/supabase'
import { cacheMeetings, getCachedMeetings } from '@/db/indexeddb'

export const useMeetingStore = defineStore('meeting', () => {
  const meetings = ref<Meeting[]>([])
  const loading = ref(false)
  const syncing = ref(false)
  const currentMonth = ref(new Date().toISOString().slice(0, 7)) // YYYY-MM

  /** 当前月份的会议列表 */
  const currentMonthMeetings = computed(() => {
    return meetings.value.filter(m => m.meeting_date.startsWith(currentMonth.value))
  })

  /** 某一天会议数量映射 */
  const dateCountMap = computed(() => {
    const map: Record<string, number> = {}
    meetings.value.forEach(m => {
      map[m.meeting_date] = (map[m.meeting_date] || 0) + 1
    })
    return map
  })

  /** 从 Supabase 拉取指定月份的会议 */
  async function fetchMeetings(yearMonth?: string) {
    const ym = yearMonth || currentMonth.value
    loading.value = true
    try {
      // 先尝试从缓存读取
      const cached = await getCachedMeetings(ym)
      if (cached.length > 0) {
        meetings.value = cached
      }

      // 从 Supabase 获取最新数据
      const start = `${ym}-01`
      const [y, m] = ym.split('-').map(Number)
      const end = `${ym}-${new Date(y, m, 0).getDate()}`

      const { data, error } = await supabase
        .from('meetings')
        .select('*')
        .gte('meeting_date', start)
        .lte('meeting_date', end)
        .order('start_time', { ascending: true })

      if (error) throw error

      if (data) {
        meetings.value = data as Meeting[]
        await cacheMeetings(data as Meeting[])
      }
    } catch (err) {
      console.error('获取会议记录失败:', err)
    } finally {
      loading.value = false
    }
  }

  /** 创建会议记录 */
  async function createMeeting(meeting: Partial<Meeting>): Promise<Meeting | null> {
    syncing.value = true
    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert([meeting])
        .select()
        .single()

      if (error) throw error

      if (data) {
        const newMeeting = data as Meeting
        meetings.value.push(newMeeting)
        await cacheMeetings([newMeeting])
        return newMeeting
      }
      return null
    } catch (err) {
      console.error('创建会议记录失败:', err)
      return null
    } finally {
      syncing.value = false
    }
  }

  /** 更新会议记录 */
  async function updateMeeting(id: string, updates: Partial<Meeting>): Promise<boolean> {
    syncing.value = true
    try {
      const { error } = await supabase
        .from('meetings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      // 更新本地数据
      const idx = meetings.value.findIndex(m => m.id === id)
      if (idx !== -1) {
        meetings.value[idx] = { ...meetings.value[idx], ...updates }
      }
      await cacheMeetings(meetings.value)
      return true
    } catch (err) {
      console.error('更新会议记录失败:', err)
      return false
    } finally {
      syncing.value = false
    }
  }

  /** 删除会议记录 */
  async function deleteMeeting(id: string): Promise<boolean> {
    syncing.value = true
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id)

      if (error) throw error

      meetings.value = meetings.value.filter(m => m.id !== id)
      await cacheMeetings(meetings.value)
      return true
    } catch (err) {
      console.error('删除会议记录失败:', err)
      return false
    } finally {
      syncing.value = false
    }
  }

  /** 切换月份 */
  function setMonth(yearMonth: string) {
    currentMonth.value = yearMonth
    fetchMeetings(yearMonth)
  }

  return {
    meetings,
    loading,
    syncing,
    currentMonth,
    currentMonthMeetings,
    dateCountMap,
    fetchMeetings,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    setMonth
  }
})
