import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { mkdtemp, readFile, rm } from 'node:fs/promises'

import {
  buildTranscriptForSummary,
  finishRecordingPipeline,
  finalizeRecordingFile,
  saveRecordingChunk,
  startRecordingSession
} from '../server/localRecording.js'

test('local recording stores ordered chunks and finalizes a webm file', async () => {
  const recordingsDir = await mkdtemp(path.join(os.tmpdir(), 'meeting-recording-'))
  try {
    const session = await startRecordingSession({
      recordingsDir,
      id: 'meeting-1',
      title: '项目例会',
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

    assert.equal(calls[0].url, 'http://asr.test/transcribe')
    assert.equal(calls[0].options.method, 'POST')
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
