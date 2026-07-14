import {
  authHeaders as sharedAuthHeaders,
  clearStoredToken as clearSharedStoredToken,
  promptForToken as promptForSharedToken
} from './useAuthToken.js'

const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...sharedAuthHeaders() },
    ...options
  })
  if (res.status === 401) {
    clearSharedStoredToken()
    const token = promptForSharedToken()
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
      headers: sharedAuthHeaders()
    })
    if (res.status === 401) {
      clearSharedStoredToken()
      const token = promptForSharedToken()
      if (token) return exportMeeting(id, format)
    }
    if (!res.ok) throw new Error('导出失败')
    return res.blob()
  }

  async function exportMonth(year, month, format = 'md') {
    const mm = String(month).padStart(2, '0')
    const res = await fetch(`${BASE}/meetings/export/month?month=${year}-${mm}&format=${format}`, {
      headers: sharedAuthHeaders()
    })
    if (res.status === 401) {
      clearSharedStoredToken()
      const token = promptForSharedToken()
      if (token) return exportMonth(year, month, format)
    }
    if (!res.ok) throw new Error('导出失败')
    return res.blob()
  }

  async function getModelGatewaySettings() {
    return request('/settings/model-gateway')
  }

  async function updateModelGatewaySettings(modelGatewayUrl) {
    return request('/settings/model-gateway', {
      method: 'PUT',
      body: JSON.stringify({ modelGatewayUrl })
    })
  }

  async function testModelGateway() {
    return request('/model/health')
  }

  return {
    fetchMeetings,
    getMeeting,
    createMeeting,
    updateMeeting,
    deleteMeeting,
    exportMeeting,
    exportMonth,
    getModelGatewaySettings,
    updateModelGatewaySettings,
    testModelGateway
  }
}
