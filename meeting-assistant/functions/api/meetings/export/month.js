import {
  assertAuthorized,
  errorResponse,
  listMeetings,
  markdownResponse,
  meetingToMarkdown,
  validateMonth
} from '../../../_shared/meetings.js'

export async function onRequestGet(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const url = new URL(context.request.url)
    const month = validateMonth(url.searchParams.get('month'))
    const [year, mon] = month.split('-').map(Number)
    const meetings = await listMeetings(context.env.DB, month)

    const lines = []
    lines.push(`# 会议纪要月报 - ${year}年${mon}月`)
    lines.push('')
    lines.push(`共 ${meetings.length} 场会议`)
    lines.push('')

    for (const meeting of meetings) {
      lines.push('---')
      lines.push('')
      lines.push(meetingToMarkdown(meeting))
    }

    return markdownResponse(
      lines.join('\n'),
      `会议纪要月报-${year}年${mon}月.md`
    )
  } catch (error) {
    return errorResponse(error)
  }
}
