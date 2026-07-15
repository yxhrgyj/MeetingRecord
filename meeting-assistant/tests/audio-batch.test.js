import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createAudioBatchItems,
  formatCompletedAudioBatch,
  moveAudioBatchItem,
  runAudioBatch
} from '../shared/audioBatch.js'

test('creates items in natural filename order', () => {
  const items = createAudioBatchItems([
    { name: 'meeting-10.mp3', size: 1 },
    { name: 'meeting-2.mp3', size: 1 }
  ])

  assert.deepEqual(items.map(item => item.filename), ['meeting-2.mp3', 'meeting-10.mp3'])
  assert.deepEqual(items.map(item => item.index), [0, 1])
})

test('assigns distinct item ids to duplicate filenames', () => {
  const items = createAudioBatchItems([
    { name: 'recording.wav', size: 1, lastModified: 10 },
    { name: 'recording.wav', size: 1, lastModified: 10 }
  ])

  assert.notEqual(items[0].id, items[1].id)
})

test('moves an item and reindexes the batch', () => {
  const items = createAudioBatchItems([
    { name: '01.wav', size: 1 },
    { name: '02.wav', size: 1 }
  ])

  const moved = moveAudioBatchItem(items, 1, 0)

  assert.deepEqual(moved.map(item => item.filename), ['02.wav', '01.wav'])
  assert.deepEqual(moved.map(item => item.index), [0, 1])
})

test('stops after a failed item without uploading later files', async () => {
  const calls = []
  const result = await runAudioBatch({
    items: createAudioBatchItems([
      { name: '01.wav', size: 1 },
      { name: '02.wav', size: 1 }
    ]),
    transcribeFile: async file => {
      calls.push(file.name)
      throw new Error('ASR offline')
    }
  })

  assert.deepEqual(calls, ['01.wav'])
  assert.equal(result[0].status, 'failed')
  assert.equal(result[1].status, 'selected')
})

test('skips completed items when retrying and formats completed transcripts once', async () => {
  const calls = []
  const result = await runAudioBatch({
    items: [
      { index: 0, filename: '01.wav', file: { name: '01.wav' }, status: 'completed', transcript: 'first', error: '' },
      { index: 1, filename: '02.wav', file: { name: '02.wav' }, status: 'selected', transcript: '', error: '' }
    ],
    transcribeFile: async file => {
      calls.push(file.name)
      return { transcript: 'second' }
    }
  })

  assert.deepEqual(calls, ['02.wav'])
  assert.match(formatCompletedAudioBatch(result), /## 01\.wav\n\nfirst\n\n## 02\.wav\n\nsecond/)
})
