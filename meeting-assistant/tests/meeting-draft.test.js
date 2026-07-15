import test from 'node:test'
import assert from 'node:assert/strict'

import { canAutoSaveMeeting } from '../src/domain/meetingDraft.js'

test('canAutoSaveMeeting requires title and date before saving content', () => {
  assert.equal(canAutoSaveMeeting({ title: '', date: '2026-07-15', transcript: '转写' }), false)
  assert.equal(canAutoSaveMeeting({ title: '会议', date: '', transcript: '转写' }), false)
  assert.equal(canAutoSaveMeeting({ title: '会议', date: '2026-07-15', transcript: '' }), false)
  assert.equal(canAutoSaveMeeting({ title: '会议', date: '2026-07-15', transcript: '转写' }), true)
})
