import {
  assertAuthorized,
  deleteMeeting,
  errorResponse,
  getMeeting,
  updateMeeting
} from '../../_shared/meetings.js'

export async function onRequestGet(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const meeting = await getMeeting(context.env.DB, context.params.id)
    if (!meeting) return Response.json({ message: '会议不存在' }, { status: 404 })
    return Response.json(meeting)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function onRequestPut(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const body = await context.request.json()
    const meeting = await updateMeeting(context.env.DB, context.params.id, body)
    return Response.json(meeting)
  } catch (error) {
    return errorResponse(error)
  }
}

export async function onRequestDelete(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const result = await deleteMeeting(context.env.DB, context.params.id)
    return Response.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
