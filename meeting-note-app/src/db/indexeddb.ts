import Dexie, { type Table } from 'dexie'
import type { Meeting } from '@/types'

/** 本地 IndexedDB 数据库，用于离线缓存 */
class MeetingDatabase extends Dexie {
  meetings!: Table<Meeting, string>
  syncQueue!: Table<{ id?: number; operation: 'insert' | 'update' | 'delete'; meetingId: string; data?: Partial<Meeting>; timestamp: number }, number>

  constructor() {
    super('MeetingRecordDB')
    this.version(1).stores({
      meetings: 'id, meeting_date, updated_at',
      syncQueue: '++id, meetingId, timestamp'
    })
  }
}

export const localDb = new MeetingDatabase()

/** 将远程数据同步到本地缓存 */
export async function cacheMeetings(meetings: Meeting[]): Promise<void> {
  await localDb.meetings.bulkPut(meetings)
}

/** 从本地缓存读取某个月的会议 */
export async function getCachedMeetings(yearMonth: string): Promise<Meeting[]> {
  const start = `${yearMonth}-01`
  const [y, m] = yearMonth.split('-').map(Number)
  const end = `${yearMonth}-${new Date(y, m, 0).getDate()}`
  return localDb.meetings
    .where('meeting_date')
    .between(start, end, true, true)
    .toArray()
}

/** 获取某一天的会议 */
export async function getCachedMeetingsByDate(date: string): Promise<Meeting[]> {
  return localDb.meetings
    .where('meeting_date')
    .equals(date)
    .toArray()
}

/** 离线操作队列 */
export async function addToSyncQueue(op: { operation: 'insert' | 'update' | 'delete'; meetingId: string; data?: Partial<Meeting> }): Promise<void> {
  await localDb.syncQueue.add({ ...op, timestamp: Date.now() })
}

export async function getPendingSyncItems(): Promise<Array<{ operation: string; meetingId: string; data?: Partial<Meeting>; timestamp: number }>> {
  return localDb.syncQueue.orderBy('timestamp').toArray()
}

export async function clearSyncQueue(): Promise<void> {
  await localDb.syncQueue.clear()
}
