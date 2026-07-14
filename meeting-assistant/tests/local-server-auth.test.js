import test from 'node:test'
import assert from 'node:assert/strict'
import { requireAccessToken } from '../serverAuth.js'

test('local API auth allows requests when no token is configured', () => {
  const next = createNext()
  const res = createResponse()

  requireAccessToken(createRequest(), res, next, {})

  assert.equal(next.called, true)
  assert.equal(res.statusCode, null)
})

test('local API auth rejects missing or wrong bearer token when configured', () => {
  const missingNext = createNext()
  const missingRes = createResponse()

  requireAccessToken(createRequest(), missingRes, missingNext, {
    MEETING_ACCESS_TOKEN: 'secret'
  })

  assert.equal(missingNext.called, false)
  assert.equal(missingRes.statusCode, 401)
  assert.equal(missingRes.headers['WWW-Authenticate'], 'Bearer')
  assert.deepEqual(missingRes.body, { message: 'Unauthorized access' })

  const wrongNext = createNext()
  const wrongRes = createResponse()

  requireAccessToken(
    createRequest({ authorization: 'Bearer wrong' }),
    wrongRes,
    wrongNext,
    { MEETING_ACCESS_TOKEN: 'secret' }
  )

  assert.equal(wrongNext.called, false)
  assert.equal(wrongRes.statusCode, 401)
})

test('local API auth accepts the configured bearer token', () => {
  const next = createNext()
  const res = createResponse()

  requireAccessToken(
    createRequest({ authorization: 'Bearer secret' }),
    res,
    next,
    { MEETING_ACCESS_TOKEN: 'secret' }
  )

  assert.equal(next.called, true)
  assert.equal(res.statusCode, null)
})

test('local API auth allows CORS preflight requests', () => {
  const next = createNext()
  const res = createResponse()

  requireAccessToken(
    createRequest({}, 'OPTIONS'),
    res,
    next,
    { MEETING_ACCESS_TOKEN: 'secret' }
  )

  assert.equal(next.called, true)
  assert.equal(res.statusCode, null)
})

function createRequest(headers = {}, method = 'GET') {
  return {
    method,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] || ''
      }
    }
  }
}

function createResponse() {
  return {
    statusCode: null,
    headers: {},
    body: null,
    set(name, value) {
      this.headers[name] = value
      return this
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(body) {
      this.body = body
      return this
    }
  }
}

function createNext() {
  function next() {
    next.called = true
  }
  next.called = false
  return next
}
