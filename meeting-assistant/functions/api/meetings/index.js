import {
  assertAuthorized,
  createMeeting,
  errorResponse,
  listMeetings
} from '../../_shared/meetings.js'

export async function onRequestGet(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const url = new URL(context.request.url)
    const meetings = await listMeetings(context.env.DB, url.searchParams.get('month'))
    return Response.json(meetings)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function onRequestPost(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const body = await context.request.json()
    const meeting = await createMeeting(context.env.DB, body)
    return Response.json(meeting, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
