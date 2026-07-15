import test from 'node:test'
import assert from 'node:assert/strict'

import { mergeSummaryIntoContent, useSummarizer } from '../src/composables/useSummarizer.js'

function fakeStorage(values = {}) {
  const store = new Map(Object.entries(values))
  return {
    getItem(key) {
      return store.get(key) || ''
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    }
  }
}

test('summarizeContent posts editor content to local API', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
return new Response(JSON.stringify({ summary: '## 会议纪要草稿\n\n### 关键结论\n- 继续推进', model: 'qwen3.5:9b' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const { summarizeContent } = useSummarizer({ baseUrl: '/api' })
  const result = await summarizeContent('## 语音转写原文\n[00:00-00:30]\n讨论预算。')

  assert.equal(calls[0].url, '/api/summarize')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    content: '## 语音转写原文\n[00:00-00:30]\n讨论预算。'
  })
  assert.equal(result.summary, '## 会议纪要草稿\n\n### 关键结论\n- 继续推进')
})

test('summarizeContent sends stored meeting access token to cloud API proxy', async () => {
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = fakeStorage({ meeting_access_token: 'meeting-token' })
  const calls = []

  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({ summary: 'done' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { summarizeContent } = useSummarizer({ baseUrl: '/api' })
    await summarizeContent('transcript')

    assert.equal(calls[0].url, '/api/summarize')
    assert.equal(calls[0].options.headers.Authorization, 'Bearer meeting-token')
  } finally {
    globalThis.localStorage = previousStorage
  }
})

test('summarizeContent rejects empty content before calling API', async () => {
  let called = false
  globalThis.fetch = async () => {
    called = true
    return new Response('{}')
  }

  const { summarizeContent } = useSummarizer({ baseUrl: '/api' })

  await assert.rejects(() => summarizeContent('   '), /没有可整理的转写内容/)
  assert.equal(called, false)
})

test('summarizeContent surfaces API error message', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'LLM 服务不可用' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  })

  const { summarizeContent } = useSummarizer({ baseUrl: '/api' })

  await assert.rejects(() => summarizeContent('有效内容'), /LLM 服务不可用/)
})

test('mergeSummaryIntoContent appends a draft after transcript', () => {
  const merged = mergeSummaryIntoContent('## 语音转写原文\n\n原文内容', '## 会议纪要草稿\n\n### 关键结论\n- 继续推进')

  assert.equal(merged, '## 语音转写原文\n\n原文内容\n\n## 会议纪要草稿\n\n### 关键结论\n- 继续推进')
})

test('mergeSummaryIntoContent replaces an existing draft', () => {
  const merged = mergeSummaryIntoContent(
    '## 语音转写原文\n\n原文内容\n\n## 会议纪要草稿\n\n旧内容',
    '## 会议纪要草稿\n\n新内容'
  )

  assert.equal(merged, '## 语音转写原文\n\n原文内容\n\n## 会议纪要草稿\n\n新内容')
})
