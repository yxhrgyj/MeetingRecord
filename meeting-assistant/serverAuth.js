export function requireAccessToken(req, res, next, env = process.env) {
  if (req.method === 'OPTIONS') {
    next()
    return
  }

  const expected = String(env.MEETING_ACCESS_TOKEN || '').trim()
  if (!expected) {
    next()
    return
  }

  const header = getHeader(req, 'authorization')
  const actual = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (actual === expected) {
    next()
    return
  }

  res
    .set('WWW-Authenticate', 'Bearer')
    .status(401)
    .json({ message: 'Unauthorized access' })
}

function getHeader(req, name) {
  if (typeof req.headers?.get === 'function') {
    return req.headers.get(name) || ''
  }
  return req.headers?.[name.toLowerCase()] || ''
}
