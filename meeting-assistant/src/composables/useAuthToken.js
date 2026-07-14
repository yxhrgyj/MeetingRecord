const TOKEN_KEY = 'meeting_access_token'

export function getStoredToken(storage = globalThis.localStorage) {
  return storage?.getItem?.(TOKEN_KEY) || ''
}

export function clearStoredToken(storage = globalThis.localStorage) {
  storage?.removeItem?.(TOKEN_KEY)
}

export function promptForToken(promptImpl = globalThis.prompt, storage = globalThis.localStorage) {
  const token = promptImpl?.('请输入会议助手访问口令') || ''
  if (token) storage?.setItem?.(TOKEN_KEY, token)
  return token
}

export function authHeaders(storage = globalThis.localStorage) {
  const token = getStoredToken(storage)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchWithAuth(url, options = {}, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(url, withAuthHeaders(options))
  if (response.status !== 401) return response

  clearStoredToken()
  const token = promptForToken()
  if (!token) return response

  return fetchImpl(url, withAuthHeaders(options))
}

function withAuthHeaders(options = {}) {
  return {
    ...options,
    headers: {
      ...normalizeHeaders(options.headers),
      ...authHeaders()
    }
  }
}

function normalizeHeaders(headers = {}) {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }
  return { ...headers }
}
