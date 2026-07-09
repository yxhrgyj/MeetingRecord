const DEFAULT_LOCAL_AGENT_BASE_URL = 'http://127.0.0.1:3001/api'

export function resolveLocalAgentBaseUrl({ env = import.meta.env, location = globalThis.location } = {}) {
  if (env?.VITE_LOCAL_AGENT_BASE_URL) {
    return env.VITE_LOCAL_AGENT_BASE_URL
  }
  if (location?.port === '3001') {
    return `${location.origin}/api`
  }
  return DEFAULT_LOCAL_AGENT_BASE_URL
}

function getDefaultBaseUrl() {
  return resolveLocalAgentBaseUrl()
}

async function readError(response) {
  const payload = await response.json().catch(() => null)
  return payload?.message || payload?.detail || 'Local recording request failed.'
}

export function useLocalRecording(options = {}) {
  const baseUrl = (options.baseUrl || getDefaultBaseUrl()).replace(/\/$/, '')
  const fetchImpl = options.fetchImpl || globalThis.fetch

  async function requestJson(url, options = {}) {
    const response = await fetchImpl(url, options)
    if (!response.ok) {
      throw new Error(await readError(response))
    }
    return response.json()
  }

  function checkHealth() {
    return requestJson(`${baseUrl}/local/health`)
  }

  function startRecording(metadata = {}) {
    return requestJson(`${baseUrl}/local/recordings/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    })
  }

  function uploadChunk({ recordingId, index, blob }) {
    const mimeType = blob?.type || 'audio/webm'
    return requestJson(`${baseUrl}/local/recordings/${encodeURIComponent(recordingId)}/chunks?index=${encodeURIComponent(index)}`, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: blob
    })
  }

  function finishRecording(recordingId) {
    return requestJson(`${baseUrl}/local/recordings/${encodeURIComponent(recordingId)}/finish`, {
      method: 'POST'
    })
  }

  return {
    checkHealth,
    startRecording,
    uploadChunk,
    finishRecording
  }
}
