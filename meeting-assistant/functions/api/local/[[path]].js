import { assertAuthorized, errorResponse } from '../../_shared/meetings.js'
import { proxyModelGatewayRequest } from '../../_shared/modelGateway.js'

export async function onRequest(context) {
  const auth = assertAuthorized(context.request, context.env)
  if (auth) return auth

  try {
    const sourceUrl = new URL(context.request.url)
    return await proxyModelGatewayRequest({
      db: context.env.DB,
      env: context.env,
      request: context.request,
      targetPath: sourceUrl.pathname
    })
  } catch (error) {
    return errorResponse(error)
  }
}
