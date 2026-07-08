import test from 'node:test'
import assert from 'node:assert/strict'

import { formatTranscriptForEditor, useAsr } from '../src/composables/useAsr.js'

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

test('formatTranscriptForEditor formats timestamped segments', () => {
  const formatted = formatTranscriptForEditor({
    text: 'fallback',
    segments: [
      { startSeconds: 0, endSeconds: 59.5, text: '涨上睡你中心预算五百一十万 <zh-CN>' },
      { startSeconds: 59.5, endSeconds: 125.2, text: '你转成 PDF 先发给我' },
    ],
  })

  assert.match(formatted, /## 语音转写原文/)
  assert.match(formatted, /\[00:00-00:59\]\n掌上信息中心预算五百一十万/)
  assert.match(formatted, /## 会议纪要草稿/)
  assert.match(formatted, /### 金额\/预算/)
  assert.match(formatted, /五百一十万/)
  assert.match(formatted, /### 待办事项/)
  assert.match(formatted, /你转成 PDF 先发给我/)
})
