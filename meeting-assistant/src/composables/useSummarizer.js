import { fetchWithAuth } from './useAuthToken.js'
import { splitTranscriptIntoChunks } from '../../shared/longMeeting.js'

const DEFAULT_SUMMARIZER_BASE_URL = '/api'

function getDefaultBaseUrl() {
  return import.meta.env?.VITE_API_BASE_URL || DEFAULT_SUMMARIZER_BASE_URL
}

async function readError(response) {
  const payload = await response.json().catch(() => null)
  return payload?.message || payload?.detail || 'LLM service request failed.'
}

export function mergeSummaryIntoContent(content, summary) {
  const normalizedContent = String(content || '').trimEnd()
  const normalizedSummary = String(summary || '').trim()
  const marker = '## 会议纪要草稿'
  const existingDraftIndex = normalizedContent.indexOf(marker)

  if (existingDraftIndex >= 0) {
    return `${normalizedContent.slice(0, existingDraftIndex).trimEnd()}\n\n${normalizedSummary}`
  }

  return normalizedContent ? `${normalizedContent}\n\n${normalizedSummary}` : normalizedSummary
}

export function useSummarizer(options = {}) {
  const baseUrl = (options.baseUrl || getDefaultBaseUrl()).replace(/\/$/, '')
  const fetchImpl = options.fetchImpl || globalThis.fetch

  async function summarizeContent(content) {
    const normalizedContent = String(content || '').trim()
    if (!normalizedContent) {
      throw new Error('没有可整理的转写内容')
    }

    const response = await fetchWithAuth(`${baseUrl}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: normalizedContent })
    }, fetchImpl)

    if (!response.ok) {
      throw new Error(await readError(response))
    }

    return response.json()
  }

  async function requestJson(path, body) {
    const response = await fetchWithAuth(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, fetchImpl)
    if (!response.ok) throw new Error(await readError(response))
    return response.json()
  }

  async function summarizeLongMeeting(content, {
    chunkOptions = {},
    onProgress = () => {},
    onStageSummary = () => {},
    existingStageSummaries = [],
    startStageIndex = 0
  } = {}) {
    const normalizedContent = String(content || '').trim()
    if (!normalizedContent) throw new Error('娌℃湁鍙暣鐞嗙殑杞啓鍐呭')

    const chunks = splitTranscriptIntoChunks(normalizedContent, chunkOptions)
    const stageSummaries = existingStageSummaries
      .filter(item => String(item?.content || '').trim())
      .map(item => ({ index: Number(item.index) || 0, content: String(item.content).trim() }))

    for (let index = startStageIndex; index < chunks.length; index += 1) {
      onProgress({ phase: 'stage', index, total: chunks.length })
      const result = await requestJson('/summarize/stage', {
        content: chunks[index],
        index,
        total: chunks.length
      })
      stageSummaries[index] = { index, content: String(result.summary || '').trim() }
      onStageSummary(stageSummaries[index])
    }

    const orderedStageSummaries = stageSummaries
      .filter(item => item?.content)
      .sort((left, right) => left.index - right.index)
    onProgress({ phase: 'final', total: orderedStageSummaries.length })
    const finalResult = await requestJson('/summarize/final', { summaries: orderedStageSummaries })
    return {
      summary: finalResult.summary,
      stageSummaries: orderedStageSummaries,
      chunks
    }
  }

  return { summarizeContent, summarizeLongMeeting }
}
