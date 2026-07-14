const DEFAULT_ASR_BASE_URL = 'http://127.0.0.1:8000'
const TERM_CORRECTIONS = [
  ['涨上睡你中心', '掌上信息中心'],
  ['长上睡你中心', '掌上信息中心'],
  ['长上讯息中心', '掌上信息中心'],
  ['长上信息中心', '掌上信息中心'],
  ['长上信息', '掌上信息'],
  ['涨上信息', '掌上信息'],
  ['C TV', 'CTV'],
]

function getDefaultBaseUrl() {
  return import.meta.env?.VITE_ASR_BASE_URL || DEFAULT_ASR_BASE_URL
}

async function readError(response) {
  const payload = await response.json().catch(() => null)
  return payload?.detail || payload?.message || 'ASR service request failed.'
}

function cleanTranscriptText(text) {
  let cleaned = String(text || '')
    .replace(/\s*<zh-CN>\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  for (const [from, to] of TERM_CORRECTIONS) {
    cleaned = cleaned.replaceAll(from, to)
  }
  return cleaned
}

function formatTimestamp(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function segmentLabel(segment) {
  return `[${formatTimestamp(segment.startSeconds)}-${formatTimestamp(segment.endSeconds)}]`
}

export function formatTranscriptForEditor(result) {
  const segments = Array.isArray(result?.segments) ? result.segments : []
  const normalizedSegments = segments
    .map((segment) => ({ ...segment, text: cleanTranscriptText(segment.text) }))
    .filter((segment) => segment.text)
  const formattedSegments = normalizedSegments
    .map((segment) => {
      return `${segmentLabel(segment)}\n${segment.text}`
    })

  if (formattedSegments.length) {
    return [
      '## 语音转写原文',
      '',
      formattedSegments.join('\n\n'),
    ].join('\n')
  }

  const text = cleanTranscriptText(result?.text)
  if (!text) return ''
  return ['## 语音转写原文', '', text].join('\n')
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
