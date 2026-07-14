import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkModelGatewayHealth,
  readModelGatewayUrl,
  normalizeModelGatewayUrl,
  proxyModelGatewayRequest,
  writeModelGatewayUrl
} from '../functions/_shared/modelGateway.js'

test('model gateway URL is normalized and validated', () => {
  assert.equal(
    normalizeModelGatewayUrl(' https://example.trycloudflare.com/ '),
    'https://example.trycloudflare.com'
  )
  assert.equal(normalizeModelGatewayUrl(''), '')
  assert.throws(() => normalizeModelGatewayUrl('ftp://example.test'), /http or https/)
  assert.throws(() => normalizeModelGatewayUrl('not a url'), /valid URL/)
})

test('model gateway URL can be stored in and read from D1 settings', async () => {
  const db = new FakeSettingsD1()

  const saved = await writeModelGatewayUrl(
    db,
    'https://example.trycloudflare.com/',
    '2026-07-10T01:00:00.000Z'
  )
  const read = await readModelGatewayUrl(db)

  assert.deepEqual(saved, {
    modelGatewayUrl: 'https://example.trycloudflare.com',
    updatedAt: '2026-07-10T01:00:00.000Z'
  })
  assert.equal(read, 'https://example.trycloudflare.com')
})

test('model gateway health check calls configured service with bearer token', async () => {
  const db = new FakeSettingsD1({
    model_gateway_url: {
      value: 'https://example.trycloudflare.com',
      updatedAt: '2026-07-10T01:00:00.000Z'
    }
  })
  const calls = []

  const result = await checkModelGatewayHealth(
    db,
    { MODEL_GATEWAY_TOKEN: 'secret' },
    async (url, options) => {
      calls.push({ url, options })
      return Response.json({ ok: true, model: 'local' })
    }
  )

  assert.equal(calls[0].url, 'https://example.trycloudflare.com/health')
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret')
  assert.equal(result.ok, true)
  assert.equal(result.status, 200)
  assert.deepEqual(result.service, { ok: true, model: 'local' })
})

test('model gateway health check reports missing URL as a bad request', async () => {
  const db = new FakeSettingsD1()

  await assert.rejects(
    () => checkModelGatewayHealth(db, {}, async () => Response.json({ ok: true })),
    error => error.status === 400 && /not configured/.test(error.message)
  )
})

test('model gateway proxy forwards request path, body, content type, and bearer token', async () => {
  const db = new FakeSettingsD1({
    model_gateway_url: {
      value: 'https://model.example.test',
      updatedAt: '2026-07-10T01:00:00.000Z'
    }
  })
  const calls = []
  const request = new Request('https://app.example.test/api/summarize', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer meeting-access-token',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: 'transcript' })
  })

  const response = await proxyModelGatewayRequest({
    db,
    env: { MODEL_GATEWAY_TOKEN: 'secret' },
    request,
    targetPath: '/api/summarize',
    fetchImpl: async (url, options) => {
      calls.push({ url, options })
      return Response.json({ summary: 'done' }, { status: 201 })
    }
  })

  assert.equal(calls[0].url, 'https://model.example.test/api/summarize')
  assert.equal(calls[0].options.method, 'POST')
  assert.equal(
    new Headers(calls[0].options.headers).get('Authorization'),
    'Bearer secret'
  )
  assert.equal(calls[0].options.headers['Content-Type'], 'application/json')
  assert.equal(calls[0].options.body, JSON.stringify({ content: 'transcript' }))
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), { summary: 'done' })
})

class FakeSettingsD1 {
  constructor(settings = {}) {
    this.settings = { ...settings }
  }

  prepare(sql) {
    return new FakeSettingsStatement(this, sql)
  }
}

class FakeSettingsStatement {
  constructor(db, sql) {
    this.db = db
    this.sql = sql
    this.values = []
  }

  bind(...values) {
    this.values = values
    return this
  }

  async first() {
    if (this.sql.includes('SELECT') && this.sql.includes('FROM app_settings')) {
      const row = this.db.settings[this.values[0]]
      return row ? { key: this.values[0], ...row } : null
    }
    return null
  }

  async run() {
    if (this.sql.includes('INSERT INTO app_settings')) {
      const [key, value, updatedAt] = this.values
      this.db.settings[key] = { value, updatedAt }
    }
    return { success: true }
  }
}
