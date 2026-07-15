import { fetchWithAuth } from './useAuthToken.js'

const DEFAULT_LOCAL_AGENT_BASE_URL = 'http://127.0.0.1:3001/api'
export const DEFAULT_AUDIO_UPLOAD_CHUNK_SIZE = 16 * 1024 * 1024

export function resolveLocalAgentBaseUrl({ env = import.meta.env, location = globalThis.location } = {}) {
  if (env?.VITE_LOCAL_AGENT_BASE_URL) {
    return env.VITE_LOCAL_AGENT_BASE_URL
  }
  if (location?.port === '3001') {
    return `${location.origin}/api`
  }
  if (!isLocalPage(location)) {
    return '/api'
  }
  return DEFAULT_LOCAL_AGENT_BASE_URL
}

function isLocalPage(location) {
  const hostname = location?.hostname || getHostname(location?.origin)
  return ['localhost', '127.0.0.1', '::1'].includes(hostname)
}

function getHostname(origin) {
  try {
    return origin ? new URL(origin).hostname : ''
  } catch {
    return ''
  }
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
    const response = await fetchWithAuth(url, options, fetchImpl)
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

  function startAudioUpload(metadata = {}) {
    return requestJson(`${baseUrl}/local/uploads/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    })
  }

  function uploadAudioChunk({ uploadId, index, blob }) {
    const mimeType = blob?.type || 'application/octet-stream'
    return requestJson(`${baseUrl}/local/uploads/${encodeURIComponent(uploadId)}/chunks?index=${encodeURIComponent(index)}`, {
      method: 'POST',
      headers: { 'Content-Type': mimeType },
      body: blob
    })
  }

  function finishAudioUpload(uploadId, chunkCount) {
    return requestJson(`${baseUrl}/local/uploads/${encodeURIComponent(uploadId)}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunkCount })
    })
  }

  function listRecordingJobs() {
    return requestJson(`${baseUrl}/local/recordings`)
  }

  function retryRecording(recordingId) {
    return requestJson(`${baseUrl}/local/recordings/${encodeURIComponent(recordingId)}/retry`, {
      method: 'POST'
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

  async function queueRecording(recordingId, { retry = false } = {}) {
    const encodedId = encodeURIComponent(recordingId)
    const action = retry ? 'retry' : 'finish'
    return requestJson(`${baseUrl}/local/recordings/${encodedId}/${action}`, {
      method: 'POST'
    })
  }

  function getRecordingStatus(recordingId) {
    const encodedId = encodeURIComponent(recordingId)
    return requestJson(`${baseUrl}/local/recordings/${encodedId}/status`)
  }

  async function waitForRecording(recordingId, { intervalMs = 500, maxAttempts = 240, onStatus = () => {} } = {}) {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const job = await getRecordingStatus(recordingId)
      onStatus(job)
      if (job.status === 'completed') return job.result ? { ...job.result } : job
      if (job.status === 'failed') throw new Error(job.error || 'Local recording processing failed.')
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error('Local recording processing timed out. Please retry.')
  }

  async function finishRecording(recordingId, options = {}) {
    const initial = await queueRecording(recordingId)
    if (initial.status === 'completed') return initial.result ? { ...initial.result } : initial
    if (initial.status === 'failed') throw new Error(initial.error || 'Local recording processing failed.')

    return waitForRecording(recordingId, options)
  }

  async function transcribeUploadedAudio(file, metadata = {}, options = {}) {
    if (!file?.size) throw new Error('Audio file is empty.')
    const chunkSize = Math.max(1, Number(options.chunkSize || DEFAULT_AUDIO_UPLOAD_CHUNK_SIZE))
    const chunkCount = Math.ceil(file.size / chunkSize)
    const session = await startAudioUpload({
      filename: file.name || 'audio',
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      ...metadata
    })

    for (let index = 0; index < chunkCount; index += 1) {
      const start = index * chunkSize
      const end = Math.min(file.size, start + chunkSize)
      await uploadAudioChunk({
        uploadId: session.id,
        index,
        blob: file.slice(start, end, file.type || 'application/octet-stream')
      })
      options.onProgress?.({ phase: 'upload', index, total: chunkCount })
    }

    const initial = await finishAudioUpload(session.id, chunkCount)
    if (initial.status === 'completed') return initial.result ? { ...initial.result } : initial
    if (initial.status === 'failed') throw new Error(initial.error || 'Audio transcription failed.')

    return waitForRecording(session.id, {
      ...options,
      onStatus: (job) => {
        options.onStatus?.(job)
      }
    })
  }

  return {
    checkHealth,
    startRecording,
    uploadChunk,
    startAudioUpload,
    uploadAudioChunk,
    finishAudioUpload,
    transcribeUploadedAudio,
    listRecordingJobs,
    retryRecording,
    queueRecording,
    getRecordingStatus,
    waitForRecording,
    finishRecording
  }
}
