import test from 'node:test'
import assert from 'node:assert/strict'

import { useSummarizer } from '../src/composables/useSummarizer.js'

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

test('summarizeLongMeeting runs stage summaries in order before final summary', async () => {
  const calls = []
  const progress = []
  const completedStages = []
  const client = useSummarizer({
    baseUrl: '/api',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/summarize/stage')) {
        const body = JSON.parse(options.body)
        return jsonResponse({ summary: `stage-${body.index}` })
      }
      return jsonResponse({ summary: 'final-minutes' })
    }
  })

  const result = await client.summarizeLongMeeting('第一段。\n\n第二段。', {
    chunkOptions: { minChars: 1, maxChars: 8 },
    onProgress: event => progress.push(event),
    onStageSummary: stage => completedStages.push(stage)
  })

  assert.deepEqual(calls.map(call => call.url), [
    '/api/summarize/stage',
    '/api/summarize/stage',
    '/api/summarize/final'
  ])
  assert.deepEqual(result.stageSummaries, [
    { index: 0, content: 'stage-0' },
    { index: 1, content: 'stage-1' }
  ])
  assert.equal(result.summary, 'final-minutes')
  assert.deepEqual(progress.map(item => item.phase), ['stage', 'stage', 'final'])
  assert.deepEqual(completedStages, [
    { index: 0, content: 'stage-0' },
    { index: 1, content: 'stage-1' }
  ])
})

test('summarizeLongMeeting stops before final when a stage fails', async () => {
  const calls = []
  const client = useSummarizer({
    baseUrl: '/api',
    fetchImpl: async (url) => {
      calls.push(url)
      return url.endsWith('/stage')
        ? jsonResponse({ message: 'stage unavailable' }, 503)
        : jsonResponse({ summary: 'should not run' })
    }
  })

  await assert.rejects(
    () => client.summarizeLongMeeting('first.\n\nsecond.', {
      chunkOptions: { minChars: 1, maxChars: 8 }
    }),
    /stage unavailable/
  )
  assert.deepEqual(calls, ['/api/summarize/stage'])
})

test('summarizeLongMeeting can retry final using completed stage summaries', async () => {
  const calls = []
  const client = useSummarizer({
    baseUrl: '/api',
    fetchImpl: async (url) => {
      calls.push(url)
      return jsonResponse({ summary: 'retried final minutes' })
    }
  })

  const result = await client.summarizeLongMeeting('first.\n\nsecond.', {
    chunkOptions: { minChars: 1, maxChars: 8 },
    existingStageSummaries: [
      { index: 0, content: 'stage-0' },
      { index: 1, content: 'stage-1' }
    ],
    startStageIndex: 2
  })

  assert.deepEqual(calls, ['/api/summarize/final'])
  assert.equal(result.summary, 'retried final minutes')
})
