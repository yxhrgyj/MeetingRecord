import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildSummaryInputs,
  sortCompletedSegments,
  splitTranscriptIntoChunks
} from '../shared/longMeeting.js'

test('splitTranscriptIntoChunks keeps short transcript in one chunk', () => {
  assert.deepEqual(splitTranscriptIntoChunks('one short paragraph.'), ['one short paragraph.'])
})

test('splitTranscriptIntoChunks prefers paragraph and sentence boundaries', () => {
  const first = 'A'.repeat(12)
  const second = 'B'.repeat(12)
  const third = 'C'.repeat(12)
  const chunks = splitTranscriptIntoChunks(`${first}。\n\n${second}。\n\n${third}。`, {
    minChars: 10,
    maxChars: 28
  })

  assert.deepEqual(chunks, [`${first}。`, `${second}。`, `${third}。`])
})

test('splitTranscriptIntoChunks hard splits a single oversized paragraph', () => {
  assert.deepEqual(splitTranscriptIntoChunks('abcdefghij', { minChars: 2, maxChars: 4 }), [
    'abcd',
    'efgh',
    'ij'
  ])
})

test('buildSummaryInputs sorts completed recording segments by recording order', () => {
  const inputs = buildSummaryInputs([
    { id: 'two', index: 1, status: 'completed', transcript: 'second' },
    { id: 'one', index: 0, status: 'completed', transcript: 'first' },
    { id: 'failed', index: 2, status: 'failed', transcript: 'ignore' }
  ])

  assert.equal(inputs, '录音第 1 段\nfirst\n\n录音第 2 段\nsecond')
})
