import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeUploadedAudioFiles, resolveLocalAgentBaseUrl, useLocalRecording } from '../src/composables/useLocalRecording.js'

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

test('resolveLocalAgentBaseUrl uses same origin when served by the local agent', () => {
  assert.equal(
    resolveLocalAgentBaseUrl({
      env: {},
      location: { origin: 'http://192.168.1.20:3001', port: '3001' }
    }),
    'http://192.168.1.20:3001/api'
  )
})

test('resolveLocalAgentBaseUrl uses cloud API proxy on deployed pages', () => {
  assert.equal(
    resolveLocalAgentBaseUrl({
      env: {},
      location: { origin: 'https://meeting-assistant-136.pages.dev', port: '' }
    }),
    '/api'
  )
})

test('resolveLocalAgentBaseUrl defaults to localhost for vite pages', () => {
  assert.equal(
    resolveLocalAgentBaseUrl({
      env: {},
      location: { origin: 'http://127.0.0.1:5173', hostname: '127.0.0.1', port: '5173' }
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

test('useLocalRecording uploads a selected audio file in bounded transport chunks', async () => {
  const calls = []
  const client = useLocalRecording({
    baseUrl: 'http://local.test/api',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/uploads/start')) {
        return Response.json({ id: 'upload-1', status: 'uploading' }, { status: 201 })
      }
      if (url.includes('/uploads/upload-1/chunks')) {
        return Response.json({ index: Number(new URL(url).searchParams.get('index')) }, { status: 201 })
      }
      if (url.endsWith('/uploads/upload-1/finish')) {
        return Response.json({ id: 'upload-1', status: 'completed', result: { transcript: 'done' } })
      }
      throw new Error(`unexpected request ${url}`)
    }
  })

  const result = await client.transcribeUploadedAudio(
    new File(['abcdefghij'], 'meeting.mp3', { type: 'audio/mpeg' }),
    { title: '长会议' },
    { chunkSize: 4 }
  )

  assert.equal(result.transcript, 'done')
  const chunkCalls = calls.filter(call => call.url.includes('/chunks'))
  assert.equal(chunkCalls.length, 3)
  assert.deepEqual(chunkCalls.map(call => call.options.body.size), [4, 4, 2])
  assert.equal(calls.find(call => call.url.endsWith('/uploads/start')).options.method, 'POST')
})

test('useLocalRecording queues an uploaded audio file without waiting for transcription', async () => {
  const calls = []
  const client = useLocalRecording({
    baseUrl: 'http://local.test/api',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/uploads/start')) return Response.json({ id: 'upload-1' }, { status: 201 })
      if (url.includes('/uploads/upload-1/chunks')) return Response.json({ index: 0 }, { status: 201 })
      if (url.endsWith('/uploads/upload-1/finish')) return Response.json({ id: 'upload-1', status: 'queued' }, { status: 202 })
      throw new Error(`unexpected request ${url}`)
    }
  })

  const job = await client.queueUploadedAudio(
    new File(['audio'], 'meeting.mp3', { type: 'audio/mpeg' }),
    { title: 'Batch meeting' }
  )

  assert.deepEqual(job, { id: 'upload-1', status: 'queued' })
  assert.equal(calls.filter(call => call.url.endsWith('/status')).length, 0)
})

test('normalizeUploadedAudioFiles joins sequential browser recording chunks into one WebM', async () => {
  const files = [
    new File(['cluster-two'], 'chunk-000002.webm', { type: 'audio/webm' }),
    new File(['webm-header'], 'chunk-000000.webm', { type: 'audio/webm' }),
    new File(['cluster-one'], 'chunk-000001.webm', { type: 'audio/webm' })
  ]

  const normalized = normalizeUploadedAudioFiles(files)

  assert.equal(normalized.length, 1)
  assert.equal(normalized[0].name, 'meeting-chunks-000000-000002.webm')
  assert.equal(await normalized[0].text(), 'webm-headercluster-onecluster-two')
})

test('normalizeUploadedAudioFiles rejects a recording chunk selection with a missing part', () => {
  assert.throws(() => normalizeUploadedAudioFiles([
    new File(['header'], 'chunk-000000.webm', { type: 'audio/webm' }),
    new File(['later'], 'chunk-000002.webm', { type: 'audio/webm' })
  ]), /missing chunk 000001/i)
})

test('useLocalRecording lists persisted jobs and retries a failed recording', async () => {
  const calls = []
  const client = useLocalRecording({
    baseUrl: 'http://local.test/api',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      if (url.startsWith('http://local.test/api/local/recordings?')) {
        return Response.json([{ id: 'old-job', status: 'failed', error: 'temporary' }])
      }
      if (url.endsWith('/old-job/retry')) {
        return Response.json({ id: 'old-job', status: 'queued' }, { status: 202 })
      }
      throw new Error(`unexpected request ${url}`)
    }
  })

  const jobs = await client.listRecordingJobs('meeting-1')
  const retry = await client.retryRecording('old-job')

  assert.equal(jobs[0].id, 'old-job')
  assert.equal(retry.status, 'queued')
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[0].url, 'http://local.test/api/local/recordings?meetingId=meeting-1')
})

test('useLocalRecording sends stored meeting access token to cloud API proxy', async () => {
  const previousStorage = globalThis.localStorage
  globalThis.localStorage = fakeStorage({ meeting_access_token: 'meeting-token' })
  const calls = []

  try {
    const client = useLocalRecording({
      baseUrl: '/api',
      fetchImpl: async (url, options) => {
        calls.push({ url, options })
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
    })

    await client.checkHealth()

    assert.equal(calls[0].url, '/api/local/health')
    assert.equal(calls[0].options.headers.Authorization, 'Bearer meeting-token')
  } finally {
    globalThis.localStorage = previousStorage
  }
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
      if (url.endsWith('/finish')) {
        return new Response(JSON.stringify({ id: 'rec-1', status: 'processing' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      if (url.endsWith('/status')) {
        return new Response(JSON.stringify({
          id: 'rec-1',
          status: 'completed',
          result: { asr: { text: '转写' }, summary: '纪要' }
        }), {
          status: 200,
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
  assert.equal(calls[3].url, 'http://local.test/api/local/recordings/rec-1/status')
  assert.equal(result.summary, '纪要')
})
