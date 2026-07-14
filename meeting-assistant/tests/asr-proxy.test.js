import test from 'node:test'
import assert from 'node:assert/strict'

import { proxyAsrTranscription } from '../server/asrProxy.js'

test('proxyAsrTranscription forwards audio upload to local ASR service', async () => {
  const calls = []

  const response = await proxyAsrTranscription({
    body: Buffer.from('audio-bytes'),
    contentType: 'multipart/form-data; boundary=test',
    asrBaseUrl: 'http://asr.test',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return Response.json({
        text: 'recognized',
        language: 'zh-CN'
      }, { status: 201 })
    }
  })

  assert.equal(calls[0].url, 'http://asr.test/transcribe')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(calls[0].options.headers['Content-Type'], 'multipart/form-data; boundary=test')
  assert.deepEqual(Buffer.from(calls[0].options.body), Buffer.from('audio-bytes'))
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), {
    text: 'recognized',
    language: 'zh-CN'
  })
})

test('proxyAsrTranscription forwards ASR error response', async () => {
  const response = await proxyAsrTranscription({
    body: Buffer.from('bad-audio'),
    contentType: 'application/octet-stream',
    asrBaseUrl: 'http://asr.test/',
    fetchImpl: async () => Response.json({ detail: 'Only audio uploads are supported.' }, { status: 415 })
  })

  assert.equal(response.status, 415)
  assert.deepEqual(await response.json(), { detail: 'Only audio uploads are supported.' })
})
