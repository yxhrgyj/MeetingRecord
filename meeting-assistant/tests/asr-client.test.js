import test from 'node:test'
import assert from 'node:assert/strict'

import { useAsr } from '../src/composables/useAsr.js'

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
