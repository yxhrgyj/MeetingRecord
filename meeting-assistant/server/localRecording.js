import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'

const DEFAULT_CHUNK_MIME_TYPE = 'audio/webm'

function safeRecordingId(id) {
  const normalized = String(id || '').trim()
  if (!/^[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error('Invalid recording id.')
  }
  return normalized
}

function recordingPath(recordingsDir, recordingId) {
  return path.join(recordingsDir, safeRecordingId(recordingId))
}

function padChunkIndex(index) {
  return String(Number(index) || 0).padStart(6, '0')
}

function formatTimestamp(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0))
  const minutes = Math.floor(safeSeconds / 60)
  const remainingSeconds = safeSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

async function readError(response) {
  const payload = await response.json().catch(() => null)
  return payload?.detail || payload?.message || `Request failed with ${response.status}`
}

export async function startRecordingSession({ recordingsDir, id = randomUUID(), title = '', now = new Date() }) {
  const recordingId = safeRecordingId(id)
  const dir = recordingPath(recordingsDir, recordingId)
  await mkdir(dir, { recursive: true })
  const manifest = {
    id: recordingId,
    title: String(title || '').trim(),
    createdAt: now.toISOString(),
    chunks: []
  }
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  return { id: recordingId, dir, title: manifest.title, createdAt: manifest.createdAt }
}

export async function saveRecordingChunk({ recordingsDir, recordingId, index, data, mimeType = DEFAULT_CHUNK_MIME_TYPE }) {
  const dir = recordingPath(recordingsDir, recordingId)
  await mkdir(dir, { recursive: true })
  const chunkIndex = Number(index)
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error('Invalid recording chunk index.')
  }
  const filename = `chunk-${padChunkIndex(chunkIndex)}.webm`
  const filePath = path.join(dir, filename)
  await writeFile(filePath, Buffer.from(data))
  return {
    index: chunkIndex,
    filename,
    filePath,
    mimeType: mimeType || DEFAULT_CHUNK_MIME_TYPE
  }
}

export async function finalizeRecordingFile({ recordingsDir, recordingId }) {
  const dir = recordingPath(recordingsDir, recordingId)
  const entries = await readdir(dir)
  const chunkNames = entries
    .filter((entry) => /^chunk-\d+\.webm$/.test(entry))
    .sort()
  if (!chunkNames.length) {
    throw new Error('No recording chunks were uploaded.')
  }

  const outputPath = path.join(dir, 'meeting.webm')
  const chunks = []
  for (const chunkName of chunkNames) {
    chunks.push(await readFile(path.join(dir, chunkName)))
  }
  await writeFile(outputPath, Buffer.concat(chunks))
  const outputStat = await stat(outputPath)
  return {
    filePath: outputPath,
    filename: 'meeting.webm',
    mimeType: DEFAULT_CHUNK_MIME_TYPE,
    size: outputStat.size
  }
}

export function buildTranscriptForSummary(asrResult) {
  const segments = Array.isArray(asrResult?.segments) ? asrResult.segments : []
  const formattedSegments = segments
    .map((segment) => {
      const text = String(segment?.text || '').trim()
      if (!text) return ''
      return `[${formatTimestamp(segment.startSeconds)}-${formatTimestamp(segment.endSeconds)}]\n${text}`
    })
    .filter(Boolean)

  if (formattedSegments.length) {
    return formattedSegments.join('\n\n')
  }

  return String(asrResult?.text || '').trim()
}

export async function transcribeRecordingFile({ filePath, filename = 'meeting.webm', mimeType = DEFAULT_CHUNK_MIME_TYPE, asrBaseUrl, fetchImpl = globalThis.fetch }) {
  const body = new FormData()
  const data = await readFile(filePath)
  body.append('file', new Blob([data], { type: mimeType }), filename)

  const response = await fetchImpl(`${asrBaseUrl.replace(/\/$/, '')}/transcribe`, {
    method: 'POST',
    body
  })

  if (!response.ok) {
    throw new Error(await readError(response))
  }

  return response.json()
}

export async function finishRecordingPipeline({ recordingsDir, recordingId, asrBaseUrl, fetchImpl = globalThis.fetch, summarizeFn }) {
  const recording = await finalizeRecordingFile({ recordingsDir, recordingId })
  const asr = await transcribeRecordingFile({
    filePath: recording.filePath,
    filename: recording.filename,
    mimeType: recording.mimeType,
    asrBaseUrl,
    fetchImpl
  })
  const transcript = buildTranscriptForSummary(asr)
  if (!transcript) {
    return { recording, asr, transcript, summary: '' }
  }
  const summary = await summarizeFn(transcript)
  return { recording, asr, transcript, summary }
}
