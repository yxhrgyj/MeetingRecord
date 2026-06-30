import {
  assertAuthorized,
  errorResponse,
  getMeeting,
  markdownResponse,
  meetingToMarkdown
} from '../../../_shared/meetings.js'

export async function onRequestGet(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const meeting = await getMeeting(context.env.DB, context.params.id)
    if (!meeting) return Response.json({ message: '会议不存在' }, { status: 404 })

    return markdownResponse(
      meetingToMarkdown(meeting),
      `会议纪要-${meeting.title}-${meeting.date}.md`
    )
  } catch (error) {
    return errorResponse(error)
  }
}
