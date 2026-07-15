import test from 'node:test'
import assert from 'node:assert/strict'

import { createSummaryHandlers } from '../server/summaryRoutes.js'

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    }
  }
}

test('stage summary handler rejects missing content', async () => {
  const res = responseRecorder()
  const handlers = createSummaryHandlers({
    summarizeStage: async () => 'should not run'
  })

  await handlers.stage({ body: {} }, res)

  assert.equal(res.statusCode, 400)
  assert.match(res.body.message, /内容/)
})

test('stage summary handler returns a stage summary and model', async () => {
  const res = responseRecorder()
  const handlers = createSummaryHandlers({
    summarizeStage: async (content, metadata) => `stage:${metadata.index}:${content}`
  })

  await handlers.stage({ body: { content: 'chunk', index: 1, total: 3 } }, res)

  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.body, { summary: 'stage:1:chunk', model: 'qwen3.5:9b' })
})

test('final summary handler rejects an empty stage summary list', async () => {
  const res = responseRecorder()
  const handlers = createSummaryHandlers({
    summarizeFinal: async () => 'should not run'
  })

  await handlers.final({ body: { summaries: [] } }, res)

  assert.equal(res.statusCode, 400)
  assert.match(res.body.message, /阶段摘要/)
})

test('final summary handler submits ordered stage summaries', async () => {
  const res = responseRecorder()
  let received
  const handlers = createSummaryHandlers({
    summarizeFinal: async summaries => {
      received = summaries
      return 'final minutes'
    }
  })

  await handlers.final({ body: {
    summaries: [
      { index: 1, content: 'second' },
      { index: 0, content: 'first' }
    ]
  } }, res)

  assert.deepEqual(received, [
    { index: 0, content: 'first' },
    { index: 1, content: 'second' }
  ])
  assert.deepEqual(res.body, { summary: 'final minutes', model: 'qwen3.5:9b' })
})
