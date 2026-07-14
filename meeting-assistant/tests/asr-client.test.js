import test from 'node:test'
import assert from 'node:assert/strict'

import { formatTranscriptForEditor, resolveAsrBaseUrl, useAsr } from '../src/composables/useAsr.js'

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

test('resolveAsrBaseUrl uses cloud API proxy on deployed pages', () => {
  assert.equal(
    resolveAsrBaseUrl({
      env: {},
      location: { origin: 'https://meeting-assistant-136.pages.dev', port: '' }
    }),
    '/api/asr'
  )
})

test('resolveAsrBaseUrl defaults to local ASR for vite pages', () => {
  assert.equal(
    resolveAsrBaseUrl({
      env: {},
      location: { origin: 'http://127.0.0.1:5173', hostname: '127.0.0.1', port: '5173' }
    }),
    'http://127.0.0.1:8000'
  )
})

test('transcribeAudio posts audio file to local ASR service', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify({ text: 'recognized', language: 'zh-CN', durationSeconds: 1.2 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const { transcribeAudio } = useAsr({ baseUrl: 'http://asr.test' })
  const result = await transcribeAudio(new File(['audio'], 'sample.mp3', { type: 'audio/mpeg' }))

  assert.equal(calls[0].url, 'http://asr.test/transcribe')
  assert.equal(calls[0].options.method, 'POST')
  assert.ok(calls[0].options.body instanceof FormData)
  assert.deepEqual(result, { text: 'recognized', language: 'zh-CN', durationSeconds: 1.2 })
})

test('transcribeAudio sends stored meeting access token to cloud API proxy', async () => {
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = fakeStorage({ meeting_access_token: 'meeting-token' })
  const calls = []

  try {
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({ text: 'recognized' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const { transcribeAudio } = useAsr({ baseUrl: '/api/asr' })
    await transcribeAudio(new File(['audio'], 'sample.mp3', { type: 'audio/mpeg' }))

    assert.equal(calls[0].url, '/api/asr/transcribe')
    assert.equal(calls[0].options.headers?.Authorization, 'Bearer meeting-token')
  } finally {
    globalThis.localStorage = previousStorage
  }
})

test('transcribeAudio surfaces ASR error detail', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ detail: 'Only WAV and MP3 uploads are supported.' }), {
    status: 415,
    headers: { 'Content-Type': 'application/json' }
  })

  const { transcribeAudio } = useAsr({ baseUrl: 'http://asr.test' })

  await assert.rejects(
    () => transcribeAudio(new File(['bad'], 'bad.txt', { type: 'text/plain' })),
    /Only WAV and MP3 uploads are supported/
  )
})

test('formatTranscriptForEditor formats cleaned timestamped segments', () => {
  const formatted = formatTranscriptForEditor({
    text: 'fallback',
    segments: [
      { startSeconds: 0, endSeconds: 59.5, text: '涨上睡你中心预算五百一十万 <zh-CN>' },
      { startSeconds: 59.5, endSeconds: 125.2, text: '你转成 PDF 先发给我' },
    ],
  })

  assert.match(formatted, /## 语音转写原文/)
  assert.match(formatted, /\[00:00-00:59\]\n掌上信息中心预算五百一十万/)
  assert.match(formatted, /\[00:59-02:05\]\n你转成 PDF 先发给我/)
  assert.doesNotMatch(formatted, /## 会议纪要草稿/)
})
