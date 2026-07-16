import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, readFile, rm } from 'node:fs/promises'

import {
  buildTranscriptForSummary,
  finishRecordingPipeline,
  finalizeRecordingFile,
  finalizeUploadedAudioFile,
  readRecordingJob,
  saveRecordingChunk,
  saveUploadedAudioChunk,
  startAudioUploadJob,
  startRecordingJob,
  startAudioUploadSession,
  startRecordingSession,
  retryRecordingJob
} from '../server/localRecording.js'

test('uploaded audio chunks are reassembled in byte order without decoding them', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-upload-'))
  try {
    const session = await startAudioUploadSession({
      recordingsDir,
      id: 'upload-1',
      filename: 'meeting.mp3',
      mimeType: 'audio/mpeg',
      size: 11,
      title: '长会议'
    })

    await saveUploadedAudioChunk({ recordingsDir, uploadId: session.id, index: 1, data: Buffer.from('world') })
    await saveUploadedAudioChunk({ recordingsDir, uploadId: session.id, index: 0, data: Buffer.from('hello ') })

    const file = await finalizeUploadedAudioFile({ recordingsDir, uploadId: session.id })

    assert.equal(file.filename, 'meeting.mp3')
    assert.equal(file.mimeType, 'audio/mpeg')
    assert.equal(await readFile(file.filePath, 'utf8'), 'hello world')
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('uploaded audio records the meeting that owns the transcription job', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-upload-owner-'))
  try {
    const session = await startAudioUploadSession({
      recordingsDir,
      id: 'upload-owner-1',
      filename: 'meeting.mp3',
      size: 5,
      meetingId: 'meeting-owner-1'
    })
    await saveUploadedAudioChunk({ recordingsDir, uploadId: session.id, index: 0, data: Buffer.from('audio') })
    const file = await finalizeUploadedAudioFile({ recordingsDir, uploadId: session.id, chunkCount: 1 })

    assert.equal(file.meetingId, 'meeting-owner-1')
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('uploaded audio job retries from the assembled source file', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-upload-job-'))
  try {
    const session = await startAudioUploadSession({
      recordingsDir,
      id: 'upload-job-1',
      filename: 'meeting.wav',
      mimeType: 'audio/wav',
      size: 5
    })
    await saveUploadedAudioChunk({ recordingsDir, uploadId: session.id, index: 0, data: Buffer.from('audio') })
    await finalizeUploadedAudioFile({ recordingsDir, uploadId: session.id, chunkCount: 1 })

    let calls = 0
    const fetchImpl = async (url, options) => {
      calls += 1
      assert.equal(url, 'http://asr.test/transcribe-file')
      assert.equal(options.headers['X-Filename'], 'meeting.wav')
      return Response.json({ text: 'uploaded transcript', segments: [] })
    }

    await startAudioUploadJob({
      recordingsDir,
      uploadId: session.id,
      asrBaseUrl: 'http://asr.test',
      fetchImpl
    })

    let completed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    for (let attempt = 0; attempt < 100 && completed?.status !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
      completed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    }

    assert.equal(completed.status, 'completed')
    assert.equal(completed.result.transcript, 'uploaded transcript')
    assert.equal(calls, 1)
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('retryRecordingJob preserves the uploaded-audio processing pipeline', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-upload-retry-'))
  try {
    const session = await startAudioUploadSession({
      recordingsDir,
      id: 'upload-retry-1',
      filename: 'meeting.mp3',
      mimeType: 'audio/mpeg',
      size: 5
    })
    await saveUploadedAudioChunk({ recordingsDir, uploadId: session.id, index: 0, data: Buffer.from('audio') })
    await finalizeUploadedAudioFile({ recordingsDir, uploadId: session.id, chunkCount: 1 })
    await startAudioUploadJob({
      recordingsDir,
      uploadId: session.id,
      asrBaseUrl: 'http://asr.test',
      fetchImpl: async () => new Response(JSON.stringify({ detail: 'ASR unavailable' }), { status: 503 })
    })

    let failed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    for (let attempt = 0; attempt < 100 && failed?.status !== 'failed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
      failed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    }

    await retryRecordingJob({
      recordingsDir,
      recordingId: session.id,
      asrBaseUrl: 'http://asr.test',
      fetchImpl: async () => Response.json({ text: 'retry succeeded', segments: [] })
    })

    let completed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    for (let attempt = 0; attempt < 100 && completed?.status !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
      completed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    }
    assert.equal(completed.status, 'completed')
    assert.equal(completed.result.transcript, 'retry succeeded')
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('uploaded audio jobs wait for the active ASR job before starting the next one', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-upload-queue-'))
  try {
    for (const id of ['upload-queue-1', 'upload-queue-2']) {
      const session = await startAudioUploadSession({
        recordingsDir,
        id,
        filename: `${id}.mp3`,
        mimeType: 'audio/mpeg',
        size: 5
      })
      await saveUploadedAudioChunk({ recordingsDir, uploadId: session.id, index: 0, data: Buffer.from('audio') })
      await finalizeUploadedAudioFile({ recordingsDir, uploadId: session.id, chunkCount: 1 })
    }

    const calls = []
    let releaseFirst
    const fetchImpl = async (url, options) => {
      calls.push(options.headers['X-Filename'])
      if (calls.length === 1) await new Promise(resolve => { releaseFirst = resolve })
      return Response.json({ text: options.headers['X-Filename'], segments: [] })
    }
    await startAudioUploadJob({ recordingsDir, uploadId: 'upload-queue-1', asrBaseUrl: 'http://asr.test', fetchImpl })
    await startAudioUploadJob({ recordingsDir, uploadId: 'upload-queue-2', asrBaseUrl: 'http://asr.test', fetchImpl })
    for (let attempt = 0; attempt < 100 && !releaseFirst; attempt += 1) await new Promise(resolve => setTimeout(resolve, 10))
    assert.deepEqual(calls, ['upload-queue-1.mp3'])
    releaseFirst()

    let second = await readRecordingJob({ recordingsDir, recordingId: 'upload-queue-2' })
    for (let attempt = 0; attempt < 100 && second?.status !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
      second = await readRecordingJob({ recordingsDir, recordingId: 'upload-queue-2' })
    }
    assert.equal(second.status, 'completed')
    assert.deepEqual(calls, ['upload-queue-1.mp3', 'upload-queue-2.mp3'])
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('local recording stores ordered chunks and finalizes a webm file', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-recording-'))
  try {
    const session = await startRecordingSession({
      recordingsDir,
      id: 'meeting-1',
      title: '项目例会',
      meetingId: 'meeting-owner-1',
      now: new Date('2026-07-09T03:00:00.000Z')
    })

    await saveRecordingChunk({
      recordingsDir,
      recordingId: session.id,
      index: 0,
      data: Buffer.from('first-'),
      mimeType: 'audio/webm'
    })
    await saveRecordingChunk({
      recordingsDir,
      recordingId: session.id,
      index: 1,
      data: Buffer.from('second'),
      mimeType: 'audio/webm'
    })

    const file = await finalizeRecordingFile({ recordingsDir, recordingId: session.id })

    assert.equal(file.filename, 'meeting.webm')
    assert.equal(file.mimeType, 'audio/webm')
    assert.equal(session.meetingId, 'meeting-owner-1')
    assert.equal(await readFile(file.filePath, 'utf8'), 'first-second')
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('buildTranscriptForSummary includes timestamps and text', () => {
  const transcript = buildTranscriptForSummary({
    segments: [
      { startSeconds: 0, endSeconds: 12, text: '讨论预算五百一十万' },
      { startSeconds: 62, endSeconds: 80, text: '张三下周提交方案' }
    ]
  })

  assert.match(transcript, /\[00:00-00:12\]\n讨论预算五百一十万/)
  assert.match(transcript, /\[01:02-01:20\]\n张三下周提交方案/)
})

test('finishRecordingPipeline transcribes finalized audio then summarizes transcript', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-recording-'))
  try {
    const session = await startRecordingSession({ recordingsDir, id: 'meeting-2' })
    await saveRecordingChunk({
      recordingsDir,
      recordingId: session.id,
      index: 0,
      data: Buffer.from('webm'),
      mimeType: 'audio/webm'
    })
    const calls = []
    const fetchImpl = async (url, options) => {
      calls.push({ url, options })
      return new Response(JSON.stringify({
        text: '讨论预算五百一十万',
        language: 'zh-CN',
        segments: [{ startSeconds: 0, endSeconds: 12, text: '讨论预算五百一十万' }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    const summarized = []
    const summarizeFn = async (content) => {
      summarized.push(content)
      return '## 会议纪要草稿\n\n### 关键结论\n- 预算待确认'
    }

    const result = await finishRecordingPipeline({
      recordingsDir,
      recordingId: session.id,
      asrBaseUrl: 'http://asr.test',
      fetchImpl,
      summarizeFn
    })

    assert.equal(calls[0].url, 'http://asr.test/transcribe-file')
    assert.equal(calls[0].options.method, 'POST')
    assert.equal(calls[0].options.headers['Content-Type'], 'audio/webm')
    assert.equal(calls[0].options.headers['X-Filename'], 'meeting.webm')
    assert.equal(calls[0].options.duplex, 'half')
    assert.equal(typeof calls[0].options.body.pipe, 'function')
    assert.match(summarized[0], /讨论预算五百一十万/)
    assert.equal(result.summary, '## 会议纪要草稿\n\n### 关键结论\n- 预算待确认')
    assert.equal(result.asr.text, '讨论预算五百一十万')
    assert.equal(result.recording.filename, 'meeting.webm')
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('finishRecordingPipeline skips summarization when ASR returns no transcript text', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-recording-'))
  try {
    const session = await startRecordingSession({ recordingsDir, id: 'meeting-3' })
    await saveRecordingChunk({
      recordingsDir,
      recordingId: session.id,
      index: 0,
      data: Buffer.from('webm'),
      mimeType: 'audio/webm'
    })
    const fetchImpl = async () => new Response(JSON.stringify({
      text: '',
      language: 'zh-CN',
      segments: [{ startSeconds: 0, endSeconds: 1, text: '' }]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    let summarizeCalled = false

    const result = await finishRecordingPipeline({
      recordingsDir,
      recordingId: session.id,
      asrBaseUrl: 'http://asr.test',
      fetchImpl,
      summarizeFn: async () => {
        summarizeCalled = true
        return 'should not happen'
      }
    })

    assert.equal(result.transcript, '')
    assert.equal(result.summary, '')
    assert.equal(summarizeCalled, false)
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('startRecordingJob returns quickly and persists the completed result', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-recording-'))
  try {
    const session = await startRecordingSession({ recordingsDir, id: 'meeting-job' })
    await saveRecordingChunk({
      recordingsDir,
      recordingId: session.id,
      index: 0,
      data: Buffer.from('webm'),
      mimeType: 'audio/webm'
    })

    const job = await startRecordingJob({
      recordingsDir,
      recordingId: session.id,
      asrBaseUrl: 'http://asr.test',
      fetchImpl: async () => new Response(JSON.stringify({
        text: '转写内容',
        segments: [{ startSeconds: 0, endSeconds: 2, text: '转写内容' }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }),
      summarizeFn: async () => '## 会议纪要草稿\n\n### 关键结论\n- 已完成'
    })

    assert.equal(job.id, session.id)
    assert.ok(['queued', 'processing', 'completed'].includes(job.status))

    let completed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    for (let attempt = 0; attempt < 100 && completed?.status !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
      completed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    }

    assert.equal(completed.status, 'completed')
    assert.equal(completed.result.summary, '## 会议纪要草稿\n\n### 关键结论\n- 已完成')
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('startRecordingJob persists a failed status when processing errors', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-recording-'))
  try {
    const session = await startRecordingSession({ recordingsDir, id: 'meeting-failed-job' })
    await saveRecordingChunk({
      recordingsDir,
      recordingId: session.id,
      index: 0,
      data: Buffer.from('webm'),
      mimeType: 'audio/webm'
    })

    await startRecordingJob({
      recordingsDir,
      recordingId: session.id,
      asrBaseUrl: 'http://asr.test',
      fetchImpl: async () => new Response(JSON.stringify({ detail: 'ASR unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }),
      summarizeFn: async () => 'should not happen'
    })

    let failed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    for (let attempt = 0; attempt < 100 && failed?.status !== 'failed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
      failed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    }

    assert.equal(failed.status, 'failed')
    assert.equal(failed.error, 'ASR unavailable')
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('startRecordingJob completes ASR-only jobs without calling a summarizer', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-recording-'))
  try {
    const session = await startRecordingSession({ recordingsDir, id: 'meeting-asr-only' })
    await saveRecordingChunk({
      recordingsDir,
      recordingId: session.id,
      index: 0,
      data: Buffer.from('webm'),
      mimeType: 'audio/webm'
    })
    let summarizeCalled = false

    await startRecordingJob({
      recordingsDir,
      recordingId: session.id,
      asrBaseUrl: 'http://asr.test',
      fetchImpl: async () => new Response(JSON.stringify({
        text: 'first segment',
        segments: [{ startSeconds: 0, endSeconds: 2, text: 'first segment' }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }),
      summarizeFn: async () => {
        summarizeCalled = true
        return 'must not run'
      },
      summarizeRecording: false
    })

    let completed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    for (let attempt = 0; attempt < 100 && completed?.status !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
      completed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    }

    assert.equal(completed.status, 'completed')
    assert.equal(completed.result.transcript, '[00:00-00:02]\nfirst segment')
    assert.equal(Object.hasOwn(completed.result, 'summary'), false)
    assert.equal(summarizeCalled, false)
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})

test('retryRecordingJob requeues a failed ASR-only recording', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-recording-'))
  try {
    const session = await startRecordingSession({ recordingsDir, id: 'meeting-retry' })
    await saveRecordingChunk({ recordingsDir, recordingId: session.id, index: 0, data: Buffer.from('webm') })
    let attempts = 0
    const fetchImpl = async () => {
      attempts += 1
      if (attempts === 1) {
        return new Response(JSON.stringify({ detail: 'temporary ASR failure' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ text: 'retry succeeded', segments: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    await startRecordingJob({
      recordingsDir,
      recordingId: session.id,
      asrBaseUrl: 'http://asr.test',
      fetchImpl,
      summarizeRecording: false
    })

    let failed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    for (let attempt = 0; attempt < 100 && failed?.status !== 'failed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
      failed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    }
    assert.equal(failed.status, 'failed')

    const retried = await startRecordingJob({
      recordingsDir,
      recordingId: session.id,
      asrBaseUrl: 'http://asr.test',
      fetchImpl,
      summarizeRecording: false,
      retry: true
    })
    assert.equal(retried.status, 'queued')

    let completed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    for (let attempt = 0; attempt < 100 && completed?.status !== 'completed'; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 10))
      completed = await readRecordingJob({ recordingsDir, recordingId: session.id })
    }
    assert.equal(completed.status, 'completed')
    assert.equal(completed.result.transcript, 'retry succeeded')
    assert.equal(attempts, 2)
  } finally {
    await rm(recordingsDir, { recursive: true, force: true })
  }
})
