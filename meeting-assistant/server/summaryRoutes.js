import {
  buildSummarizerOptions,
  summarizeFinalWithOllama,
  summarizeStageWithOllama
} from './ollamaSummarizer.js'

function normalizedStageRequest(body = {}) {
  return {
    content: String(body.content || '').trim(),
    index: Number.isInteger(Number(body.index)) ? Number(body.index) : 0,
    total: Math.max(1, Number(body.total) || 1)
  }
}

function normalizedFinalRequest(body = {}) {
  return Array.isArray(body.summaries)
    ? body.summaries
      .filter(item => String(item?.content || '').trim())
      .map(item => ({ index: Number(item.index) || 0, content: String(item.content).trim() }))
      .sort((left, right) => left.index - right.index)
    : []
}

export function createSummaryHandlers({
  summarizeStage = summarizeStageWithOllama,
  summarizeFinal = summarizeFinalWithOllama,
  summarizerOptions = buildSummarizerOptions(process.env)
} = {}) {
  return {
    async stage(req, res) {
      const input = normalizedStageRequest(req.body)
      if (!input.content) {
        return res.status(400).json({ message: '没有可整理的阶段内容' })
      }

      try {
        const summary = await summarizeStage(input.content, input, summarizerOptions)
        return res.json({ summary, model: summarizerOptions.model })
      } catch (error) {
        console.error('阶段摘要失败:', error)
        return res.status(503).json({ message: error?.message || '阶段摘要服务不可用' })
      }
    },

    async final(req, res) {
      const summaries = normalizedFinalRequest(req.body)
      if (!summaries.length) {
        return res.status(400).json({ message: '没有可整理的阶段摘要' })
      }

      try {
        const summary = await summarizeFinal(summaries, summarizerOptions)
        return res.json({ summary, model: summarizerOptions.model })
      } catch (error) {
        console.error('最终会议纪要失败:', error)
        return res.status(503).json({ message: error?.message || '最终会议纪要服务不可用' })
      }
    }
  }
}

export function registerSummaryRoutes(app, options = {}) {
  const handlers = createSummaryHandlers(options)
  app.post('/api/summarize/stage', handlers.stage)
  app.post('/api/summarize/final', handlers.final)
  return handlers
}
