const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
const DEFAULT_OLLAMA_MODEL = 'qwen3:8b'
const DEFAULT_OLLAMA_NUM_GPU = 0

export function buildMeetingSummaryPrompt(content) {
  return [
    '你是严谨的中文会议纪要助手。请只根据下面的会议转写原文整理纪要，不要编造没有出现的信息。',
    '如果某一项在原文中没有明确提到，请写“未明确”。保留关键金额、日期、人员、系统名称和任务归属。',
    '输出 Markdown，结构固定为：',
    '',
    '## 会议纪要草稿',
    '',
    '### 讨论事项',
    '- ...',
    '',
    '### 关键结论',
    '- ...',
    '',
    '### 金额/预算',
    '- ...',
    '',
    '### 待办事项',
    '- [ ] 事项 - 负责人：未明确 - 截止：未明确',
    '',
    '### 风险/待确认',
    '- ...',
    '',
    '会议转写原文：',
    '```text',
    String(content || '').trim(),
    '```'
  ].join('\n')
}

export function stripThinkingBlocks(text) {
  return String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()
}

async function readOllamaError(response) {
  const payload = await response.json().catch(() => null)
  return payload?.error || payload?.message || `Ollama request failed with ${response.status}`
}

export async function summarizeWithOllama(content, options = {}) {
  const normalizedContent = String(content || '').trim()
  if (!normalizedContent) {
    throw new Error('没有可整理的转写内容')
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch
  const baseUrl = (options.baseUrl || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, '')
  const model = options.model || DEFAULT_OLLAMA_MODEL
  const requestedNumGpu = Number(options.numGpu)
  const numGpu = Number.isFinite(requestedNumGpu) ? requestedNumGpu : DEFAULT_OLLAMA_NUM_GPU
  const response = await fetchImpl(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: buildMeetingSummaryPrompt(normalizedContent),
      stream: false,
      options: {
        temperature: 0.2,
        top_p: 0.8,
        num_gpu: numGpu
      }
    })
  })

  if (!response.ok) {
    throw new Error(await readOllamaError(response))
  }

  const payload = await response.json()
  const summary = stripThinkingBlocks(payload?.response)
  if (!summary) {
    throw new Error('LLM 没有返回纪要内容')
  }

  return summary
}
