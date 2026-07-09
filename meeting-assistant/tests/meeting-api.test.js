import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertAuthorized,
  deserializeMeeting,
  downloadContentDisposition,
  meetingToMarkdown,
  serializeMeetingPayload,
  updateMeeting
} from '../functions/_shared/meetings.js'

test('authorization is optional when no token is configured', () => {
  const response = assertAuthorized(new Request('https://example.test/api/meetings'), {})
  assert.equal(response, null)
})

test('authorization rejects missing or wrong bearer token when configured', async () => {
  const missing = assertAuthorized(new Request('https://example.test/api/meetings'), {
    MEETING_ACCESS_TOKEN: 'secret'
  })
  assert.equal(missing.status, 401)
  assert.deepEqual(await missing.json(), { message: '未授权访问' })

  const wrong = assertAuthorized(new Request('https://example.test/api/meetings', {
    headers: { Authorization: 'Bearer wrong' }
  }), {
    MEETING_ACCESS_TOKEN: 'secret'
  })
  assert.equal(wrong.status, 401)
})

test('authorization accepts the configured bearer token', () => {
  const response = assertAuthorized(new Request('https://example.test/api/meetings', {
    headers: { Authorization: 'Bearer secret' }
  }), {
    MEETING_ACCESS_TOKEN: 'secret'
  })
  assert.equal(response, null)
})

test('meeting payload validation requires date and title', () => {
  assert.throws(() => serializeMeetingPayload({ date: '2026-06-30' }), /日期和标题为必填项/)
  assert.throws(() => serializeMeetingPayload({ title: '周会' }), /日期和标题为必填项/)
})

test('meeting payload serializes attendees for D1 and trims title', () => {
  const payload = serializeMeetingPayload({
    title: '  项目例会  ',
    date: '2026-06-30',
    startTime: '09:00',
    endTime: '10:00',
    attendees: ['张三', '李四'],
    content: '讨论事项'
  }, '2026-06-30T01:00:00.000Z')

  assert.equal(payload.title, '项目例会')
  assert.equal(payload.attendeesJson, '["张三","李四"]')
  assert.equal(payload.createdAt, '2026-06-30T01:00:00.000Z')
  assert.equal(payload.updatedAt, '2026-06-30T01:00:00.000Z')
})

test('D1 row deserializes to frontend meeting shape', () => {
  const meeting = deserializeMeeting({
    id: 'm1',
    title: '评审会',
    date: '2026-06-30',
    startTime: '09:00',
    endTime: '10:00',
    attendeesJson: '["张三"]',
    content: '记录',
    createdAt: '2026-06-30T01:00:00.000Z',
    updatedAt: '2026-06-30T01:00:00.000Z'
  })

  assert.deepEqual(meeting.attendees, ['张三'])
  assert.equal(meeting.title, '评审会')
})

test('markdown export includes metadata and freeform content', () => {
  const markdown = meetingToMarkdown({
    title: '项目例会',
    date: '2026-06-30',
    startTime: '09:00',
    endTime: '10:00',
    attendees: ['张三', '李四'],
    content: '## 结论\n\n继续推进'
  })

  assert.match(markdown, /^# 项目例会/)
  assert.match(markdown, /日期/)
  assert.match(markdown, /张三、李四/)
  assert.match(markdown, /继续推进/)
})

test('downloadContentDisposition encodes non-ascii filenames for headers', () => {
  const value = downloadContentDisposition('会议纪要-组织绩效-2026-07-09.md')

  assert.match(value, /^attachment; filename="[-_.a-zA-Z0-9]+\.md"; filename\*=UTF-8''/)
  assert.match(value, /%E4%BC%9A%E8%AE%AE%E7%BA%AA%E8%A6%81/)
  assert.doesNotMatch(value, /会议纪要/)
})

test('updateMeeting updates by id so changing date across months is allowed', async () => {
  const db = new FakeD1({
    m1: {
      id: 'm1',
      title: '五月会议',
      date: '2026-05-20',
      startTime: '',
      endTime: '',
      attendeesJson: '[]',
      content: '',
      createdAt: '2026-05-20T01:00:00.000Z',
      updatedAt: '2026-05-20T01:00:00.000Z'
    }
  })

  const updated = await updateMeeting(db, 'm1', {
    id: 'm1',
    title: '六月会议',
    date: '2026-06-02',
    attendees: [],
    content: '跨月'
  }, '2026-06-30T01:00:00.000Z')

  assert.equal(updated.date, '2026-06-02')
  assert.equal(updated.content, '跨月')
  assert.ok(db.statements.some(sql => sql.includes('WHERE id = ?')))
})

class FakeD1 {
  constructor(rows) {
    this.rows = rows
    this.statements = []
  }

  prepare(sql) {
    this.statements.push(sql)
    return new FakeStatement(this, sql)
  }
}

class FakeStatement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.values = []
  }

  bind(...values) {
    this.values = values
    return this
  }

  async first() {
    if (this.sql.includes('SELECT') && this.sql.includes('WHERE id = ?')) {
      return this.db.rows[this.values[0]] || null
    }
    return null
  }

  async run() {
    if (this.sql.includes('UPDATE meetings SET')) {
      const [
        title,
        date,
        startTime,
        endTime,
        attendeesJson,
        content,
        updatedAt,
        id
      ] = this.values
      this.db.rows[id] = {
        ...this.db.rows[id],
        title,
        date,
        startTime,
        endTime,
        attendeesJson,
        content,
        updatedAt
      }
      return { success: true }
    }
    return { success: true }
  }
}
