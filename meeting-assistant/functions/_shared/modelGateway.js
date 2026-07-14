const MODEL_GATEWAY_URL_KEY = 'model_gateway_url'

export function normalizeModelGatewayUrl(input) {
  const value = String(input || '').trim()
  if (!value) return ''

  let url
  try {
    url = new URL(value)
  } catch {
    throw Object.assign(new Error('Model gateway URL must be a valid URL'), { status: 400 })
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw Object.assign(new Error('Model gateway URL must use http or https'), { status: 400 })
  }

  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

export async function readModelGatewayUrl(db) {
  const row = await db.prepare(`
    SELECT value
    FROM app_settings
    WHERE key = ?
  `).bind(MODEL_GATEWAY_URL_KEY).first()

  return row?.value || ''
}

export async function writeModelGatewayUrl(db, input, now = new Date().toISOString()) {
  const modelGatewayUrl = normalizeModelGatewayUrl(input)

  await db.prepare(`
    INSERT INTO app_settings (key, value, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updatedAt = excluded.updatedAt
  `).bind(MODEL_GATEWAY_URL_KEY, modelGatewayUrl, now).run()

  return { modelGatewayUrl, updatedAt: now }
}

export async function checkModelGatewayHealth(db, env = {}, fetchImpl = fetch) {
  const modelGatewayUrl = await readModelGatewayUrl(db)
  if (!modelGatewayUrl) {
    throw Object.assign(new Error('Model gateway URL is not configured'), { status: 400 })
  }

  const headers = {}
  const token = String(env.MODEL_GATEWAY_TOKEN || '').trim()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetchImpl(`${modelGatewayUrl}/health`, { headers })
  const service = await response.json().catch(() => null)

  return {
    ok: response.ok,
    status: response.status,
    modelGatewayUrl,
    service
  }
}

export async function proxyModelGatewayRequest({
  db,
  env = {},
  request,
  targetPath,
  fetchImpl = fetch
}) {
  const modelGatewayUrl = await readModelGatewayUrl(db)
  if (!modelGatewayUrl) {
    throw Object.assign(new Error('Model gateway URL is not configured'), { status: 400 })
  }

  const sourceUrl = new URL(request.url)
  const targetUrl = new URL(targetPath, `${modelGatewayUrl}/`)
  targetUrl.search = sourceUrl.search

  const headers = {}
  for (const [key, value] of request.headers) {
    const lowerKey = key.toLowerCase()
    if (['host', 'content-length', 'connection', 'authorization'].includes(lowerKey)) continue
    headers[lowerKey === 'content-type' ? 'Content-Type' : key] = value
  }

  const token = String(env.MODEL_GATEWAY_TOKEN || '').trim()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const options = {
    method: request.method,
    headers
  }

  if (!['GET', 'HEAD'].includes(request.method.toUpperCase())) {
    const contentType = request.headers.get('Content-Type') || ''
    options.body = isTextBody(contentType)
      ? await request.text()
      : await request.arrayBuffer()
  }

  const response = await fetchImpl(targetUrl.toString(), options)
  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-encoding')
  responseHeaders.delete('transfer-encoding')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  })
}

function isTextBody(contentType) {
  return contentType.includes('application/json') || contentType.startsWith('text/')
}
