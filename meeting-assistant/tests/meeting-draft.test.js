import test from 'node:test'
import assert from 'node:assert/strict'

import { canAutoSaveMeeting } from '../src/domain/meetingDraft.js'

test('canAutoSaveMeeting saves a titled meeting before content is entered', () => {
  assert.equal(canAutoSaveMeeting({ title: '', date: '2026-07-15', transcript: 'transcript' }), false)
  assert.equal(canAutoSaveMeeting({ title: 'Meeting', date: '', transcript: 'transcript' }), false)
  assert.equal(canAutoSaveMeeting({ title: 'Meeting', date: '2026-07-15', attendees: ['Alice'], transcript: '' }), true)
  assert.equal(canAutoSaveMeeting({ title: 'Meeting', date: '2026-07-15', transcript: 'transcript' }), true)
})
