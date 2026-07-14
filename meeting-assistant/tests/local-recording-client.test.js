import test from 'node:test'
import assert from 'node:assert/strict'

import { resolveLocalAgentBaseUrl, useLocalRecording } from '../src/composables/useLocalRecording.js'

test('resolveLocalAgentBaseUrl uses same origin when served by the local agent', () => {
  assert.equal(
    resolveLocalAgentBaseUrl({
      env: {},
      location: { origin: 'http://192.168.1.20:3001', port: '3001' }
    }),
    'http://192.168.1.20:3001/api'
  )
})

test('resolveLocalAgentBaseUrl defaults to localhost for cloud or vite pages', () => {
  assert.equal(
    resolveLocalAgentBaseUrl({
      env: {},
      location: { origin: 'https://meeting-assistant-136.pages.dev', port: '' }
    }),
    'http://127.0.0.1:3001/api'
  )
})

test('useLocalRecording calls local agent health endpoint', async () => {
  const calls = []
  const client = useLocalRecording({
    baseUrl: 'http://local.test/api',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  const result = await client.checkHealth()

  assert.equal(calls[0].url, 'http://local.test/api/local/health')
  assert.equal(result.ok, true)
})

test('useLocalRecording uploads raw recording chunks and finishes pipeline', async () => {
  const calls = []
  const client = useLocalRecording({
    baseUrl: 'http://local.test/api',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/start')) {
        return new Response(JSON.stringify({ id: 'rec-1' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      if (url.includes('/chunks')) {
        return new Response(JSON.stringify({ index: 0 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({
        asr: { text: '转写' },
        summary: '纪要'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  })

  const session = await client.startRecording({ title: '项目会' })
  await client.uploadChunk({
    recordingId: session.id,
    index: 0,
    blob: new Blob(['audio'], { type: 'audio/webm' })
  })
  const result = await client.finishRecording(session.id)

  assert.equal(calls[0].url, 'http://local.test/api/local/recordings/start')
  assert.equal(calls[1].url, 'http://local.test/api/local/recordings/rec-1/chunks?index=0')
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[1].options.headers['Content-Type'], 'audio/webm')
  assert.equal(calls[2].url, 'http://local.test/api/local/recordings/rec-1/finish')
  assert.equal(result.summary, '纪要')
})
