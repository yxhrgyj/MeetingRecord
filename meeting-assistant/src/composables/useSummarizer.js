import { fetchWithAuth } from './useAuthToken.js'

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

  return { summarizeContent }
}
