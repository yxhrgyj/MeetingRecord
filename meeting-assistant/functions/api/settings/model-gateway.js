import { assertAuthorized, errorResponse } from '../../_shared/meetings.js'
import {
  readModelGatewayUrl,
  writeModelGatewayUrl
} from '../../_shared/modelGateway.js'

export async function onRequestGet(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const modelGatewayUrl = await readModelGatewayUrl(context.env.DB)
    return Response.json({ modelGatewayUrl })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function onRequestPut(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const body = await context.request.json()
    const settings = await writeModelGatewayUrl(context.env.DB, body?.modelGatewayUrl)
    return Response.json(settings)
  } catch (error) {
    return errorResponse(error)
  }
}
