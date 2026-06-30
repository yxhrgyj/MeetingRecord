const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

export function assertAuthorized(request, env = {}) {
  const expected = String(env.MEETING_ACCESS_TOKEN || '').trim()
  if (!expected) return null

  const header = request.headers.get('Authorization') || ''
  const actual = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (actual === expected) return null

  return Response.json({ message: '未授权访问' }, {
    status: 401,
    headers: { 'WWW-Authenticate': 'Bearer' }
  })
}

export function serializeMeetingPayload(input, now = new Date().toISOString(), createdAt = now) {
  const date = String(input?.date || '').trim()
  const title = String(input?.title || '').trim()

  if (!date || !title) {
    throw Object.assign(new Error('日期和标题为必填项'), { status: 400 })
  }
  if (!DATE_RE.test(date)) {
    throw Object.assign(new Error('日期格式必须为 YYYY-MM-DD'), { status: 400 })
  }

  const attendees = Array.isArray(input.attendees)
    ? input.attendees.map(name => String(name).trim()).filter(Boolean)
    : []

  return {
    title,
    date,
    startTime: String(input.startTime || ''),
    endTime: String(input.endTime || ''),
    attendeesJson: JSON.stringify(attendees),
    content: String(input.content || ''),
    createdAt,
    updatedAt: now
  }
}

export function deserializeMeeting(row) {
  if (!row) return null

  let attendees = []
  try {
    const parsed = JSON.parse(row.attendeesJson || '[]')
    attendees = Array.isArray(parsed) ? parsed : []
  } catch {
    attendees = []
  }

  return {
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.startTime || '',
    endTime: row.endTime || '',
    attendees,
    content: row.content || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export function validateMonth(month) {
  const value = String(month || '').trim()
  if (!MONTH_RE.test(value)) {
    throw Object.assign(new Error('缺少或无效的 month 参数'), { status: 400 })
  }
  return value
}

export function monthRange(month) {
  const value = validateMonth(month)
  const [year, mon] = value.split('-').map(Number)
  const endDay = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  return {
    start: `${value}-01`,
    end: `${value}-${String(endDay).padStart(2, '0')}`
  }
}

export async function listMeetings(db, month) {
  const { start, end } = monthRange(month)
  const { results } = await db.prepare(`
    SELECT id, title, date, startTime, endTime, attendeesJson, content, createdAt, updatedAt
    FROM meetings
    WHERE date >= ? AND date <= ?
    ORDER BY date ASC, startTime ASC, createdAt ASC
  `).bind(start, end).all()

  return (results || []).map(deserializeMeeting)
}

export async function getMeeting(db, id) {
  const row = await db.prepare(`
    SELECT id, title, date, startTime, endTime, attendeesJson, content, createdAt, updatedAt
    FROM meetings
    WHERE id = ?
  `).bind(id).first()

  return deserializeMeeting(row)
}

export async function createMeeting(db, input, now = new Date().toISOString()) {
  const id = crypto.randomUUID()
  const payload = serializeMeetingPayload(input, now)

  await db.prepare(`
    INSERT INTO meetings (id, title, date, startTime, endTime, attendeesJson, content, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    payload.title,
    payload.date,
    payload.startTime,
    payload.endTime,
    payload.attendeesJson,
    payload.content,
    payload.createdAt,
    payload.updatedAt
  ).run()

  return deserializeMeeting({ id, ...payload })
}

export async function updateMeeting(db, id, input, now = new Date().toISOString()) {
  const existing = await db.prepare(`
    SELECT id, title, date, startTime, endTime, attendeesJson, content, createdAt, updatedAt
    FROM meetings
    WHERE id = ?
  `).bind(id).first()

  if (!existing) {
    throw Object.assign(new Error('会议不存在'), { status: 404 })
  }

  const payload = serializeMeetingPayload(
    { ...deserializeMeeting(existing), ...input },
    now,
    existing.createdAt
  )

  await db.prepare(`
    UPDATE meetings SET
      title = ?,
      date = ?,
      startTime = ?,
      endTime = ?,
      attendeesJson = ?,
      content = ?,
      updatedAt = ?
    WHERE id = ?
  `).bind(
    payload.title,
    payload.date,
    payload.startTime,
    payload.endTime,
    payload.attendeesJson,
    payload.content,
    payload.updatedAt,
    id
  ).run()

  return deserializeMeeting({ id, ...payload })
}

export async function deleteMeeting(db, id) {
  const existing = await getMeeting(db, id)
  if (!existing) {
    throw Object.assign(new Error('会议不存在'), { status: 404 })
  }

  await db.prepare('DELETE FROM meetings WHERE id = ?').bind(id).run()
  return { success: true }
}

export function meetingToMarkdown(m) {
  const lines = []
  lines.push(`# ${m.title}`)
  lines.push('')
  lines.push(`- **日期**: ${m.date}`)
  if (m.startTime || m.endTime) {
    lines.push(`- **时间**: ${m.startTime || ''} ${m.endTime ? '- ' + m.endTime : ''}`.trim())
  }
  if (m.attendees?.length) {
    lines.push(`- **参会人**: ${m.attendees.join('、')}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')
  if (m.content) {
    lines.push(m.content)
    lines.push('')
  }
  return lines.join('\n')
}

export function markdownResponse(markdown, filename) {
  const safeFilename = sanitizeFilename(filename)
  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
    }
  })
}

export function sanitizeFilename(name) {
  return String(name || 'meeting.md')
    .replace(/[\\/:*?"<>|\r\n]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

export function errorResponse(error) {
  const status = Number(error?.status || 500)
  const message = error?.message || '服务器错误'
  return Response.json({ message }, { status })
}
