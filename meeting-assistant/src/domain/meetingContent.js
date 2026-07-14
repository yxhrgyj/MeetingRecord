const SUMMARY_HEADING = '## 会议纪要'
const TRANSCRIPT_HEADING = '## 完整转写'
const LEGACY_SUMMARY_HEADING = '## 会议纪要草稿'

function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim()
}

function sectionAfterHeading(source, heading) {
  return source.slice(heading.length).trim()
}

export function normalizeMeetingSummary(summary) {
  const normalized = normalizeLineEndings(summary)
  if (normalized.startsWith(LEGACY_SUMMARY_HEADING)) {
    return sectionAfterHeading(normalized, LEGACY_SUMMARY_HEADING)
  }
  if (normalized.startsWith(SUMMARY_HEADING)) {
    return sectionAfterHeading(normalized, SUMMARY_HEADING)
  }
  return normalized
}

export function parseMeetingContent(content) {
  const source = normalizeLineEndings(content)
  if (!source) return { summary: '', transcript: '' }

  if (source.startsWith(LEGACY_SUMMARY_HEADING)) {
    return { summary: normalizeMeetingSummary(source), transcript: '' }
  }

  if (source.startsWith(SUMMARY_HEADING)) {
    const transcriptMarker = `\n${TRANSCRIPT_HEADING}`
    const transcriptIndex = source.indexOf(transcriptMarker)
    if (transcriptIndex >= 0) {
      const summaryBlock = source
        .slice(SUMMARY_HEADING.length, transcriptIndex)
        .trim()
        .replace(/\n---\s*$/, '')
        .trim()
      return {
        summary: normalizeMeetingSummary(summaryBlock),
        transcript: sectionAfterHeading(source.slice(transcriptIndex + 1), TRANSCRIPT_HEADING)
      }
    }
    return { summary: sectionAfterHeading(source, SUMMARY_HEADING), transcript: '' }
  }

  if (source.startsWith(TRANSCRIPT_HEADING)) {
    return { summary: '', transcript: sectionAfterHeading(source, TRANSCRIPT_HEADING) }
  }

  const legacyMarker = `\n${LEGACY_SUMMARY_HEADING}`
  const legacyIndex = source.indexOf(legacyMarker)
  if (legacyIndex >= 0) {
    return {
      summary: normalizeMeetingSummary(source.slice(legacyIndex + 1)),
      transcript: source.slice(0, legacyIndex).trim()
    }
  }

  return { summary: source, transcript: '' }
}

export function serializeMeetingContent({ summary, transcript }) {
  const normalizedSummary = normalizeMeetingSummary(summary)
  const normalizedTranscript = normalizeLineEndings(transcript)
  const sections = []

  if (normalizedSummary) {
    sections.push(`${SUMMARY_HEADING}\n\n${normalizedSummary}`)
  }
  if (normalizedTranscript) {
    sections.push(`${TRANSCRIPT_HEADING}\n\n${normalizedTranscript}`)
  }

  return sections.join('\n\n---\n\n')
}
