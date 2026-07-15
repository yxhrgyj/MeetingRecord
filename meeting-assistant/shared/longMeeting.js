const DEFAULT_MIN_CHARS = 3000
const DEFAULT_MAX_CHARS = 5000
const SENTENCE_BOUNDARY = /(?<=[。！？；.!?;])\s*/u

function normalizeText(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim()
}

function hardSplit(text, maxChars) {
  const parts = []
  let remaining = text
  while (remaining.length > maxChars) {
    parts.push(remaining.slice(0, maxChars))
    remaining = remaining.slice(maxChars).trimStart()
  }
  if (remaining) parts.push(remaining)
  return parts
}

function paragraphUnits(paragraph) {
  const normalized = paragraph.trim()
  if (!normalized) return []
  return normalized
    .split(SENTENCE_BOUNDARY)
    .map(unit => unit.trim())
    .filter(Boolean)
}

export function splitTranscriptIntoChunks(content, options = {}) {
  const normalized = normalizeText(content)
  if (!normalized) return []

  const minChars = Math.max(1, Number(options.minChars) || DEFAULT_MIN_CHARS)
  const maxChars = Math.max(minChars, Number(options.maxChars) || DEFAULT_MAX_CHARS)
  const chunks = []
  let current = ''

  const flush = () => {
    if (current) chunks.push(current.trim())
    current = ''
  }

  for (const paragraph of normalized.split(/\n\s*\n/)) {
    for (const unit of paragraphUnits(paragraph)) {
      const pieces = unit.length > maxChars ? hardSplit(unit, maxChars) : [unit]
      for (const piece of pieces) {
        const candidate = current ? `${current}\n\n${piece}` : piece
        if (current && candidate.length > maxChars) flush()
        current = current ? `${current}\n\n${piece}` : piece
      }
    }
    if (current.length >= minChars) flush()
  }

  flush()
  return chunks
}

export function sortCompletedSegments(segments = []) {
  return segments
    .filter(segment => segment?.status === 'completed' && String(segment.transcript || '').trim())
    .slice()
    .sort((left, right) => Number(left.index) - Number(right.index))
}

export function buildSummaryInputs(segments = []) {
  return sortCompletedSegments(segments)
    .map(segment => `录音第 ${Number(segment.index) + 1} 段\n${String(segment.transcript).trim()}`)
    .join('\n\n')
}

export function formatCompletedSegments(segments = []) {
  return sortCompletedSegments(segments)
    .map(segment => `## 录音第 ${Number(segment.index) + 1} 段\n\n${String(segment.transcript).trim()}`)
    .join('\n\n')
}
