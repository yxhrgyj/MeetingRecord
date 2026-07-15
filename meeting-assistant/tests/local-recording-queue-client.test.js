import test from 'node:test'
import assert from 'node:assert/strict'

import { useLocalRecording } from '../src/composables/useLocalRecording.js'

test('useLocalRecording queues a segment immediately and polls it independently', async () => {
  const calls = []
  const statusCalls = new Map()
  const client = useLocalRecording({
    baseUrl: 'http://local.test/api',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      if (url.endsWith('/finish')) {
        return new Response(JSON.stringify({ id: url.includes('one') ? 'one' : 'two', status: 'queued' }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      if (url.endsWith('/status')) {
        const id = url.includes('/one/') ? 'one' : 'two'
        const count = (statusCalls.get(id) || 0) + 1
        statusCalls.set(id, count)
        return new Response(JSON.stringify(count === 1
          ? { id, status: 'processing' }
          : { id, status: 'completed', result: { transcript: `${id} transcript` } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      throw new Error(`unexpected request ${url}`)
    }
  })

  const first = await client.queueRecording('one')
  const second = await client.queueRecording('two')
  assert.equal(first.status, 'queued')
  assert.equal(second.status, 'queued')
  assert.equal(calls.filter(call => call.url.endsWith('/finish')).length, 2)

  const oneStatuses = []
  const twoStatuses = []
  const [one, two] = await Promise.all([
    client.waitForRecording('one', { intervalMs: 1, maxAttempts: 3, onStatus: job => oneStatuses.push(job.status) }),
    client.waitForRecording('two', { intervalMs: 1, maxAttempts: 3, onStatus: job => twoStatuses.push(job.status) })
  ])
  assert.equal(one.transcript, 'one transcript')
  assert.equal(two.transcript, 'two transcript')
  assert.equal(statusCalls.get('one'), 2)
  assert.equal(statusCalls.get('two'), 2)
  assert.deepEqual(oneStatuses, ['processing', 'completed'])
  assert.deepEqual(twoStatuses, ['processing', 'completed'])
})
