const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
const DEFAULT_OLLAMA_MODEL = 'qwen3.5:9b'
const DEFAULT_OLLAMA_KEEP_ALIVE = '0s'

export function buildSummarizerOptions(env = {}) {
  const options = {
    baseUrl: env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
    model: env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL,
    keepAlive: env.OLLAMA_KEEP_ALIVE || DEFAULT_OLLAMA_KEEP_ALIVE
  }
  if (env.OLLAMA_NUM_GPU !== undefined) {
    options.numGpu = env.OLLAMA_NUM_GPU
  }
  return options
}

export function buildMeetingSummaryPrompt(content) {
  return [
    '/no_think',
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

export function buildStageSummaryPrompt(content, { index = 0, total = 1 } = {}) {
  return [
    '/no_think',
    `你是严谨的中文会议阶段摘要助手。下面是第 ${Number(index) + 1}/${Number(total)} 个阶段的转写原文。`,
    '只能依据当前阶段原文，不得补造没有出现的信息；没有明确依据时写“未明确”。',
    '输出 Markdown，固定包含以下四个部分：',
    '',
    '### 讨论事项',
    '- ...',
    '',
    '### 决策结论',
    '- ...',
    '',
    '### 待办事项（负责人/截止时间）',
    '- [ ] 事项 - 负责人：未明确 - 截止时间：未明确',
    '',
    '### 风险和未决问题',
    '- ...',
    '',
    '阶段转写原文：',
    '```text',
    String(content || '').trim(),
    '```'
  ].join('\n')
}

export function buildFinalSummaryPrompt(summaries = []) {
  const ordered = summaries
    .slice()
    .sort((left, right) => Number(left.index) - Number(right.index))
    .map(item => `### 阶段 ${Number(item.index) + 1}\n${String(item.content || '').trim()}`)
    .join('\n\n')

  return [
    '/no_think',
    '你是严谨的中文会议纪要助手。以下内容是按录音顺序生成的阶段摘要。',
    '请去重并合并跨阶段的同一议题，只依据这些阶段摘要，不要补造原文没有的信息。',
    '保留金额、日期、负责人、截止时间、系统名称和任务归属；没有依据时写“未明确”。',
    '输出完整 Markdown 会议纪要，目标长度约 1500-3000 字，内容完整性优先于机械凑字数。',
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
    '阶段摘要：',
    ordered
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

async function generateWithOllama(prompt, options = {}) {
  const normalizedPrompt = String(prompt || '').trim()
  if (!normalizedPrompt) {
    throw new Error('没有可整理的转写内容')
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch
  const baseUrl = (options.baseUrl || DEFAULT_OLLAMA_BASE_URL).replace(/\/$/, '')
  const model = options.model || DEFAULT_OLLAMA_MODEL
  const keepAlive = options.keepAlive || DEFAULT_OLLAMA_KEEP_ALIVE
  const requestedNumGpu = Number(options.numGpu)
  const ollamaOptions = {
    temperature: 0.2,
    top_p: 0.8
  }
  if (Number.isFinite(requestedNumGpu)) {
    ollamaOptions.num_gpu = requestedNumGpu
  }
  const response = await fetchImpl(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: normalizedPrompt,
      stream: false,
      think: false,
      keep_alive: keepAlive,
      options: ollamaOptions
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

export async function summarizeWithOllama(content, options = {}) {
  const normalizedContent = String(content || '').trim()
  if (!normalizedContent) {
    throw new Error('娌℃湁鍙暣鐞嗙殑杞啓鍐呭')
  }
  return generateWithOllama(buildMeetingSummaryPrompt(normalizedContent), options)
}

export async function summarizeStageWithOllama(content, metadata = {}, options = {}) {
  const normalizedContent = String(content || '').trim()
  if (!normalizedContent) {
    throw new Error('娌℃湁鍙暣鐞嗙殑杞啓鍐呭')
  }
  return generateWithOllama(buildStageSummaryPrompt(normalizedContent, metadata), options)
}

export async function summarizeFinalWithOllama(summaries = [], options = {}) {
  const normalizedSummaries = summaries
    .filter(item => String(item?.content || '').trim())
    .map(item => ({ index: Number(item.index) || 0, content: String(item.content).trim() }))
  if (!normalizedSummaries.length) {
    throw new Error('没有可整理的阶段摘要')
  }
  return generateWithOllama(buildFinalSummaryPrompt(normalizedSummaries), options)
}
