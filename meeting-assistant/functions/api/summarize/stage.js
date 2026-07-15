import { assertAuthorized, errorResponse } from '../../_shared/meetings.js'
import { proxyModelGatewayRequest } from '../../_shared/modelGateway.js'

export async function onRequestPost(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    return await proxyModelGatewayRequest({
      db: context.env.DB,
      env: context.env,
      request: context.request,
      targetPath: '/api/summarize/stage'
    })
  } catch (error) {
    return errorResponse(error)
  }
}
