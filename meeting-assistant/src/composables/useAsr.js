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

function compactLine(text, maxLength = 90) {
  const line = cleanTranscriptText(text).replace(/\s+/g, ' ').trim()
  if (line.length <= maxLength) return line
  return `${line.slice(0, maxLength)}...`
}

function unique(items) {
  return [...new Set(items.filter(Boolean))]
}

function extractMoneyItems(text) {
  const matches = cleanTranscriptText(text).match(/[一二三四五六七八九十百千万零两\d]+(?:点[一二三四五六七八九十\d]+)?万/g) || []
  return unique(matches)
}

function extractActionItems(segments) {
  return segments
    .map((segment) => {
      const text = compactLine(segment.text, 110)
      if (!/(发给我|转成|确认|需要|负责|待办|调完|调整)/.test(text)) return ''
      return `${segmentLabel(segment)} ${text}`
    })
    .filter(Boolean)
}

function buildMeetingDraft(segments, fallbackText) {
  const sourceText = segments.map((segment) => segment.text).join('\n') || fallbackText || ''
  const discussionItems = segments
    .map((segment) => {
      const text = compactLine(segment.text)
      return text ? `- ${segmentLabel(segment)} ${text}` : ''
    })
    .filter(Boolean)
    .slice(0, 12)
  const moneyItems = extractMoneyItems(sourceText).map((item) => `- ${item}`)
  const actionItems = extractActionItems(segments).map((item) => `- [ ] ${item}`)

  return [
    '## 会议纪要草稿',
    '',
    '### 讨论事项',
    discussionItems.length ? discussionItems.join('\n') : '- 待补充',
    '',
    '### 金额/预算',
    moneyItems.length ? moneyItems.join('\n') : '- 待补充',
    '',
    '### 待办事项',
    actionItems.length ? actionItems.join('\n') : '- [ ] 待补充',
  ].join('\n')
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
      '',
      buildMeetingDraft(normalizedSegments, result?.text),
    ].join('\n')
  }

  const text = cleanTranscriptText(result?.text)
  if (!text) return ''
  return ['## 语音转写原文', '', text, '', buildMeetingDraft([], text)].join('\n')
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
