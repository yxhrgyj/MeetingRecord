const BASE = '/api'
const TOKEN_KEY = 'meeting_access_token'

function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

function promptForToken() {
  const token = prompt('请输入会议助手访问口令')
  if (token) localStorage.setItem(TOKEN_KEY, token)
  return token || ''
}

function authHeaders() {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    ...options
  })
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    const token = promptForToken()
    if (token) {
      return request(path, options)
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '请求失败' }))
    throw new Error(err.message || '请求失败')
  }
  return res.json()
}

export function useApi() {
  async function fetchMeetings(year, month) {
    const mm = String(month).padStart(2, '0')
    return request(`/meetings?month=${year}-${mm}`)
  }

  async function getMeeting(id) {
    return request(`/meetings/${id}`)
  }

  async function createMeeting(data) {
    return request('/meetings', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async function updateMeeting(id, data) {
    return request(`/meetings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async function deleteMeeting(id) {
    return request(`/meetings/${id}`, { method: 'DELETE' })
  }

  async function exportMeeting(id, format = 'md') {
    const res = await fetch(`${BASE}/meetings/${id}/export?format=${format}`, {
      headers: authHeaders()
    })
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      const token = promptForToken()
      if (token) return exportMeeting(id, format)
    }
    if (!res.ok) throw new Error('导出失败')
    return res.blob()
  }

  async function exportMonth(year, month, format = 'md') {
    const mm = String(month).padStart(2, '0')
    const res = await fetch(`${BASE}/meetings/export/month?month=${year}-${mm}&format=${format}`, {
      headers: authHeaders()
    })
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      const token = promptForToken()
      if (token) return exportMonth(year, month, format)
    }
    if (!res.ok) throw new Error('导出失败')
    return res.blob()
  }

  return { fetchMeetings, getMeeting, createMeeting, updateMeeting, deleteMeeting, exportMeeting, exportMonth }
}
