import { assertAuthorized, errorResponse } from '../../_shared/meetings.js'
import { checkModelGatewayHealth } from '../../_shared/modelGateway.js'

export async function onRequestGet(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const health = await checkModelGatewayHealth(context.env.DB, context.env)
    return Response.json(health, { status: health.ok ? 200 : 502 })
  } catch (error) {
    return errorResponse(error)
  }
}
