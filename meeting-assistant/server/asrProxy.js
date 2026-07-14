export async function proxyAsrTranscription({
  body,
  contentType = 'application/octet-stream',
  asrBaseUrl,
  fetchImpl = globalThis.fetch
}) {
  const response = await fetchImpl(`${asrBaseUrl.replace(/\/$/, '')}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': contentType || 'application/octet-stream' },
    body
  })

  const responseHeaders = new Headers(response.headers)
  responseHeaders.delete('content-encoding')
  responseHeaders.delete('transfer-encoding')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders
  })
}
