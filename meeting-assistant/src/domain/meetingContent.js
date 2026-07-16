const SUMMARY_HEADING = '## 会议纪要'
const TRANSCRIPT_HEADING = '## 完整转写'
const LEGACY_SUMMARY_HEADING = '## 会议纪要草稿'
const LEGACY_ORGANIZED_SUMMARY_HEADING = '## 整理的纪要'
const LEGACY_TRANSCRIPT_HEADING = '## 语音转写原文'
const LEGACY_DETAIL_HEADING = '## 会议详情'

function normalizeLineEndings(value) {
  return String(value || '').replace(/\r\n/g, '\n').trim()
}

function sectionAfterHeading(source, heading) {
  return source.slice(heading.length).trim()
}

function markdownTableCells(line) {
  return line.trim().slice(1, -1).split('|').map(cell => cell.trim())
}

function isMarkdownTableSeparator(cells) {
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell))
}

function normalizeMarkdownTables(summary) {
  const lines = summary.split('\n')
  const normalized = []

  for (let index = 0; index < lines.length;) {
    if (!/^\s*\|.*\|\s*$/.test(lines[index])) {
      normalized.push(lines[index])
      index += 1
      continue
    }

    const tableLines = []
    while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
      tableLines.push(lines[index])
      index += 1
    }

    const header = markdownTableCells(tableLines[0])
    const separator = tableLines[1] ? markdownTableCells(tableLines[1]) : []
    if (tableLines.length < 3 || !isMarkdownTableSeparator(separator)) {
      normalized.push(...tableLines)
      continue
    }

    tableLines.slice(2).forEach((row, rowIndex) => {
      const cells = markdownTableCells(row)
      const details = header
        .map((label, cellIndex) => {
          const value = String(cells[cellIndex] || '')
            .replace(/<br\s*\/?\s*>/gi, '；')
            .replace(/&nbsp;/gi, ' ')
            .trim()
          return value ? `${label}：${value}` : ''
        })
        .filter(Boolean)
      if (details.length) normalized.push(`${rowIndex + 1}. ${details.join('；')}`)
    })
  }

  return normalized.join('\n')
}

function normalizeLegacyAiMarkdown(summary) {
  let listIndex = 0
  const lines = normalizeMarkdownTables(summary).split('\n').reduce((result, rawLine) => {
    const line = rawLine
      .replace(/<br\s*\/?\s*>/gi, '；')
      .replace(/&nbsp;/gi, ' ')
      .replace(/^\s*>\s?/, '')
      .replace(/[🔴🟡🟣🔵✅❌⚠️💡📌]/gu, '')
      .replace(/([：；])\s+/g, '$1')
      .replace(/\s*[（(][A-Za-z][A-Za-z\s/-]*[）)]\s*$/, '')
      .trim()

    if (/^(?:-{3,}|_{3,}|\*{3,})$/.test(line)) {
      return result
    }

    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*$/)
    if (heading) {
      listIndex = 0
      result.push(heading[1])
      return result
    }

    const bullet = line.match(/^[-*+]\s+(?:\[[ xX]\]\s*)?(.+)$/)
    if (bullet) {
      listIndex += 1
      result.push(`${listIndex}. ${bullet[1]}`)
      return result
    }

    if (!line) {
      listIndex = 0
      if (result.at(-1) !== '') result.push('')
      return result
    }

    listIndex = 0
    result.push(line)
    return result
  }, [])

  return lines
    .map(line => line
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/^\*([^*\n]+)\*$/, '$1')
      .replace(/^_([^_\n]+)_$/, '$1'))
    .join('\n')
    .trim()
}

function parseLegacyTranscript(source) {
  const summaryHeadings = [
    LEGACY_ORGANIZED_SUMMARY_HEADING,
    SUMMARY_HEADING,
    LEGACY_SUMMARY_HEADING
  ]
  const marker = summaryHeadings
    .map(heading => ({ heading, index: source.indexOf(`\n${heading}`) }))
    .filter(item => item.index >= 0)
    .sort((left, right) => left.index - right.index)[0]

  if (!marker) {
    return { summary: '', transcript: source }
  }

  return {
    summary: normalizeMeetingSummary(source.slice(marker.index + 1)),
    transcript: source.slice(0, marker.index).replace(/\n---\s*$/, '').trim()
  }
}

export function normalizeMeetingSummary(summary) {
  const normalized = normalizeLineEndings(summary)
  if (normalized.startsWith(LEGACY_SUMMARY_HEADING)) {
    return normalizeLegacyAiMarkdown(sectionAfterHeading(normalized, LEGACY_SUMMARY_HEADING))
  }
  if (normalized.startsWith(SUMMARY_HEADING)) {
    return normalizeLegacyAiMarkdown(sectionAfterHeading(normalized, SUMMARY_HEADING))
  }
  if (normalized.startsWith(LEGACY_ORGANIZED_SUMMARY_HEADING)) {
    return normalizeLegacyAiMarkdown(sectionAfterHeading(normalized, LEGACY_ORGANIZED_SUMMARY_HEADING))
  }
  return normalizeLegacyAiMarkdown(normalized)
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
    return { summary: normalizeMeetingSummary(sectionAfterHeading(source, SUMMARY_HEADING)), transcript: '' }
  }

  if (source.startsWith(TRANSCRIPT_HEADING)) {
    return { summary: '', transcript: sectionAfterHeading(source, TRANSCRIPT_HEADING) }
  }

  if (source.startsWith(LEGACY_TRANSCRIPT_HEADING) || source.startsWith(LEGACY_DETAIL_HEADING)) {
    return parseLegacyTranscript(source)
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
