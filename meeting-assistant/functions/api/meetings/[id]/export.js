import {
  assertAuthorized,
  errorResponse,
  getMeeting,
  markdownResponse,
  meetingToMarkdown
} from '../../../_shared/meetings.js'
import { docxResponse, meetingToDocxBlob } from '../../../_shared/docxExport.js'

export async function onRequestGet(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const meeting = await getMeeting(context.env.DB, context.params.id)
    if (!meeting) return Response.json({ message: '会议不存在' }, { status: 404 })
    const url = new URL(context.request.url)
    const format = String(url.searchParams.get('format') || 'md').toLowerCase()

    if (format === 'docx') {
      return docxResponse(
        await meetingToDocxBlob(meeting),
        `会议纪要-${meeting.title}-${meeting.date}.docx`
      )
    }

    return markdownResponse(
      meetingToMarkdown(meeting),
      `会议纪要-${meeting.title}-${meeting.date}.md`
    )
  } catch (error) {
    return errorResponse(error)
  }
}
