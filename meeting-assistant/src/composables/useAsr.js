const DEFAULT_ASR_BASE_URL = 'http://127.0.0.1:8000'

function getDefaultBaseUrl() {
  return import.meta.env?.VITE_ASR_BASE_URL || DEFAULT_ASR_BASE_URL
}

async function readError(response) {
  const payload = await response.json().catch(() => null)
  return payload?.detail || payload?.message || 'ASR service request failed.'
}

export function useAsr(options = {}) {
  const baseUrl = (options.baseUrl || getDefaultBaseUrl()).replace(/\/$/, '')

  async function transcribeAudio(file) {
    const body = new FormData()
    body.append('file', file, file.name || 'audio')

    const response = await fetch(`${baseUrl}/transcribe`, {
      method: 'POST',
      body
    })

    if (!response.ok) {
      throw new Error(await readError(response))
    }

    return response.json()
  }

  return { transcribeAudio }
}
