import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildMeetingSummaryPrompt,
  stripThinkingBlocks,
  summarizeWithOllama
} from '../server/ollamaSummarizer.js'

test('buildMeetingSummaryPrompt asks for grounded meeting notes', () => {
  const prompt = buildMeetingSummaryPrompt('[00:00-00:20]\n讨论预算五百一十万。')

  assert.match(prompt, /不要编造/)
  assert.match(prompt, /会议纪要草稿/)
  assert.match(prompt, /金额\/预算/)
  assert.match(prompt, /\[00:00-00:20\]\n讨论预算五百一十万。/)
})

test('stripThinkingBlocks removes qwen thinking output', () => {
  const cleaned = stripThinkingBlocks('<think>\n我先分析。\n</think>\n## 会议纪要草稿\n\n### 关键结论\n- 继续推进')

  assert.equal(cleaned, '## 会议纪要草稿\n\n### 关键结论\n- 继续推进')
})

test('summarizeWithOllama posts prompt to local Ollama generate API', async () => {
  const calls = []
  const fetchImpl = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({
      response: '<think>分析</think>\n## 会议纪要草稿\n\n### 关键结论\n- 继续推进'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const summary = await summarizeWithOllama('讨论预算五百一十万。', {
    fetchImpl,
    baseUrl: 'http://ollama.test',
    model: 'qwen3:8b',
    numGpu: 0
  })

  assert.equal(calls[0].url, 'http://ollama.test/api/generate')
  assert.equal(calls[0].options.method, 'POST')
  const body = JSON.parse(calls[0].options.body)
  assert.equal(body.model, 'qwen3:8b')
  assert.equal(body.stream, false)
  assert.equal(body.options.num_gpu, 0)
  assert.match(body.prompt, /讨论预算五百一十万/)
  assert.equal(summary, '## 会议纪要草稿\n\n### 关键结论\n- 继续推进')
})

test('summarizeWithOllama surfaces Ollama errors', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: 'model not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  })

  await assert.rejects(
    () => summarizeWithOllama('有效内容', { fetchImpl, baseUrl: 'http://ollama.test' }),
    /model not found/
  )
})
