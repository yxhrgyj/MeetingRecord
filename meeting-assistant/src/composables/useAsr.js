const DEFAULT_ASR_BASE_URL = 'http://127.0.0.1:8000'

function getDefaultBaseUrl() {
  return import.meta.env?.VITE_ASR_BASE_URL || DEFAULT_ASR_BASE_URL
}

async function readError(response) {
  const payload = await response.json().catch(() => null)
  return payload?.detail || payload?.message || 'ASR service request failed.'
}

function cleanTranscriptText(text) {
  return String(text || '')
    .replace(/\s*<zh-CN>\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function formatTimestamp(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

export function formatTranscriptForEditor(result) {
  const segments = Array.isArray(result?.segments) ? result.segments : []
  const formattedSegments = segments
    .map((segment) => {
      const text = cleanTranscriptText(segment.text)
      if (!text) return ''
      return `[${formatTimestamp(segment.startSeconds)}-${formatTimestamp(segment.endSeconds)}]\n${text}`
    })
    .filter(Boolean)

  if (formattedSegments.length) {
    return formattedSegments.join('\n\n')
  }

  return cleanTranscriptText(result?.text)
}

export function useAsr(options = {}) {
  const baseUrl = (options.baseUrl || getDefaultBaseUrl()).replace(/\/$/, '')

  async function transcribeAudio(file) {
    const body = new FormData()
    body.append('file', file, file.name || 'audio')

    const response = await fetch(`${baseUrl}/transcribe`, {
      method: 'POST',
      body
    })

    if (!response.ok) {
      throw new Error(await readError(response))
    }

    return response.json()
  }

  return { transcribeAudio }
}
