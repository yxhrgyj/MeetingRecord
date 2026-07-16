import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises'

const DEFAULT_CHUNK_MIME_TYPE = 'audio/webm'
const RECORDING_JOB_FILENAME = 'job.json'
const AUDIO_UPLOAD_MANIFEST_FILENAME = 'upload.json'
const AUDIO_UPLOAD_PART_RE = /^upload-(\d+)\.part$/
const SUPPORTED_AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.webm'])
export const MAX_AUDIO_UPLOAD_BYTES = 1024 * 1024 * 1024

let recordingJobQueue = Promise.resolve()
let queuedRecordingJobCount = 0

async function releaseAsrModel(asrBaseUrl) {
  try {
    await fetch(`${asrBaseUrl.replace(/\/$/, '')}/unload`, { method: 'POST' })
  } catch {
    // A release failure is non-fatal: the ASR process may already be stopping.
  }
}

function enqueueRecordingJob(task, asrBaseUrl) {
  queuedRecordingJobCount += 1
  recordingJobQueue = recordingJobQueue
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      queuedRecordingJobCount -= 1
      if (queuedRecordingJobCount === 0) void releaseAsrModel(asrBaseUrl)
    })
  return recordingJobQueue
}

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

function recordingJobPath(recordingsDir, recordingId) {
  return path.join(recordingPath(recordingsDir, recordingId), RECORDING_JOB_FILENAME)
}

function recordingManifestPath(recordingsDir, recordingId) {
  return path.join(recordingPath(recordingsDir, recordingId), 'manifest.json')
}

function audioUploadManifestPath(recordingsDir, uploadId) {
  return path.join(recordingPath(recordingsDir, uploadId), AUDIO_UPLOAD_MANIFEST_FILENAME)
}

function audioUploadPartPath(recordingsDir, uploadId, index) {
  return path.join(recordingPath(recordingsDir, uploadId), `upload-${padChunkIndex(index)}.part`)
}

function sanitizeAudioFilename(filename) {
  const basename = path.basename(String(filename || 'audio'))
  const extension = path.extname(basename).toLowerCase()
  if (!SUPPORTED_AUDIO_EXTENSIONS.has(extension)) {
    throw new Error('Only WAV, MP3, and WebM uploads are supported.')
  }
  return basename.replace(/[^a-zA-Z0-9._-]+/g, '_')
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

export async function startRecordingSession({ recordingsDir, id = randomUUID(), title = '', meetingId = '', now = new Date() }) {
  const recordingId = safeRecordingId(id)
  const dir = recordingPath(recordingsDir, recordingId)
  await mkdir(dir, { recursive: true })
  const manifest = {
    id: recordingId,
    title: String(title || '').trim(),
    meetingId: String(meetingId || '').trim(),
    createdAt: now.toISOString(),
    chunks: []
  }
  await writeFile(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8')
  return { id: recordingId, dir, title: manifest.title, meetingId: manifest.meetingId, createdAt: manifest.createdAt }
}

export async function startAudioUploadSession({
  recordingsDir,
  id = randomUUID(),
  filename,
  mimeType = 'application/octet-stream',
  size = 0,
  title = '',
  meetingId = '',
  now = new Date()
}) {
  const uploadId = safeRecordingId(id)
  const safeFilename = sanitizeAudioFilename(filename)
  const declaredSize = Number(size) || 0
  if (declaredSize <= 0 || declaredSize > MAX_AUDIO_UPLOAD_BYTES) {
    throw new Error('Audio upload must be larger than 0 and no more than 1 GB.')
  }
  const dir = recordingPath(recordingsDir, uploadId)
  await mkdir(dir, { recursive: true })
  const manifest = {
    id: uploadId,
    title: String(title || '').trim(),
    meetingId: String(meetingId || '').trim(),
    filename: safeFilename,
    mimeType: String(mimeType || 'application/octet-stream'),
    size: declaredSize,
    createdAt: now.toISOString(),
    status: 'uploading'
  }
  await writeFile(audioUploadManifestPath(recordingsDir, uploadId), JSON.stringify(manifest, null, 2), 'utf8')
  return { id: uploadId, filename: safeFilename, mimeType: manifest.mimeType, size: manifest.size, title: manifest.title, meetingId: manifest.meetingId }
}

export async function saveUploadedAudioChunk({ recordingsDir, uploadId, index, data }) {
  const normalizedId = safeRecordingId(uploadId)
  const chunkIndex = Number(index)
  if (!Number.isInteger(chunkIndex) || chunkIndex < 0) {
    throw new Error('Invalid audio upload chunk index.')
  }
  const manifest = JSON.parse(await readFile(audioUploadManifestPath(recordingsDir, normalizedId), 'utf8'))
  await writeFile(audioUploadPartPath(recordingsDir, normalizedId, chunkIndex), Buffer.from(data))
  return { index: chunkIndex, filename: manifest.filename }
}

export async function finalizeUploadedAudioFile({ recordingsDir, uploadId, chunkCount }) {
  const normalizedId = safeRecordingId(uploadId)
  const manifest = JSON.parse(await readFile(audioUploadManifestPath(recordingsDir, normalizedId), 'utf8'))
  const entries = (await readdir(recordingPath(recordingsDir, normalizedId)))
    .map(name => {
      const match = name.match(AUDIO_UPLOAD_PART_RE)
      return match ? { name, index: Number(match[1]) } : null
    })
    .filter(Boolean)
    .sort((left, right) => left.index - right.index)
  const expectedCount = Number.isInteger(Number(chunkCount)) && Number(chunkCount) > 0
    ? Number(chunkCount)
    : entries.length
  if (entries.length !== expectedCount || entries.some((entry, index) => entry.index !== index)) {
    throw new Error('Audio upload is incomplete. Please retry the missing upload chunks.')
  }

  const data = []
  for (const entry of entries) data.push(await readFile(path.join(recordingPath(recordingsDir, normalizedId), entry.name)))
  const sourcePath = path.join(recordingPath(recordingsDir, normalizedId), manifest.filename)
  await writeFile(sourcePath, Buffer.concat(data))
  const sourceStat = await stat(sourcePath)
  await writeFile(audioUploadManifestPath(recordingsDir, normalizedId), JSON.stringify({
    ...manifest,
    status: 'uploaded',
    sourcePath: manifest.filename,
    uploadedSize: sourceStat.size,
    chunkCount: expectedCount
  }, null, 2), 'utf8')
  return {
    filePath: sourcePath,
    filename: manifest.filename,
    mimeType: manifest.mimeType,
    size: sourceStat.size,
    chunkCount: expectedCount,
    meetingId: manifest.meetingId
  }
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
  const response = await fetchImpl(`${asrBaseUrl.replace(/\/$/, '')}/transcribe-file`, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType || 'application/octet-stream',
      'X-Filename': filename
    },
    body: createReadStream(filePath),
    duplex: 'half'
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
  if (!transcript || typeof summarizeFn !== 'function') {
    return { recording, asr, transcript, summary: '' }
  }
  const summary = await summarizeFn(transcript)
  return { recording, asr, transcript, summary }
}

async function readUploadedAudioFile({ recordingsDir, uploadId }) {
  const normalizedId = safeRecordingId(uploadId)
  const manifest = JSON.parse(await readFile(audioUploadManifestPath(recordingsDir, normalizedId), 'utf8'))
  const filename = String(manifest.sourcePath || manifest.filename || '')
  if (!filename) throw new Error('Uploaded audio source is missing.')
  const filePath = path.join(recordingPath(recordingsDir, normalizedId), path.basename(filename))
  const sourceStat = await stat(filePath)
  return {
    filePath,
    filename: manifest.filename,
    mimeType: manifest.mimeType || DEFAULT_CHUNK_MIME_TYPE,
    size: sourceStat.size
  }
}

export async function finishUploadedAudioPipeline({ recordingsDir, uploadId, asrBaseUrl, fetchImpl = globalThis.fetch }) {
  const recording = await readUploadedAudioFile({ recordingsDir, uploadId })
  const asr = await transcribeRecordingFile({
    filePath: recording.filePath,
    filename: recording.filename,
    mimeType: recording.mimeType,
    asrBaseUrl,
    fetchImpl
  })
  return {
    recording,
    asr,
    transcript: buildTranscriptForSummary(asr),
    summary: ''
  }
}

function toPublicRecordingResult(result) {
  const publicResult = {
    recording: {
      filename: result.recording.filename,
      size: result.recording.size
    },
    asr: result.asr,
    transcript: result.transcript
  }
  if (result.summary) publicResult.summary = result.summary
  return publicResult
}

export async function readRecordingJob({ recordingsDir, recordingId }) {
  try {
    const raw = await readFile(recordingJobPath(recordingsDir, recordingId), 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

async function writeRecordingJob({ recordingsDir, recordingId, job }) {
  const dir = recordingPath(recordingsDir, recordingId)
  await mkdir(dir, { recursive: true })
  const targetPath = recordingJobPath(recordingsDir, recordingId)
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tempPath, JSON.stringify(job, null, 2), 'utf8')
  await rename(tempPath, targetPath)
  return job
}

async function processRecordingJob({ recordingsDir, recordingId, asrBaseUrl, fetchImpl, summarizeFn, summarizeRecording }) {
  try {
    const current = await readRecordingJob({ recordingsDir, recordingId })
    if (!current || current.status === 'completed') return

    await writeRecordingJob({
      recordingsDir,
      recordingId,
      job: {
        ...current,
        status: 'processing',
        updatedAt: new Date().toISOString(),
        error: ''
      }
    })

    const result = current.sourceType === 'uploaded'
      ? await finishUploadedAudioPipeline({
        recordingsDir,
        uploadId: recordingId,
        asrBaseUrl,
        fetchImpl
      })
      : await finishRecordingPipeline({
        recordingsDir,
        recordingId,
        asrBaseUrl,
        fetchImpl,
        summarizeFn: summarizeRecording === false ? undefined : summarizeFn
      })

    await writeRecordingJob({
      recordingsDir,
      recordingId,
      job: {
        ...current,
        status: 'completed',
        updatedAt: new Date().toISOString(),
        error: '',
        result: toPublicRecordingResult(result)
      }
    })
  } catch (error) {
    const current = await readRecordingJob({ recordingsDir, recordingId })
    if (!current) return
    await writeRecordingJob({
      recordingsDir,
      recordingId,
      job: {
        ...current,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        error: error?.message || 'Recording processing failed.'
      }
    })
  }
}

export async function startRecordingJob({
  recordingsDir,
  recordingId,
  asrBaseUrl,
  fetchImpl = globalThis.fetch,
  summarizeFn,
  now = new Date(),
  summarizeRecording = true,
  retry = false
}) {
  const existing = await readRecordingJob({ recordingsDir, recordingId })
  if (existing && ['queued', 'processing', 'completed'].includes(existing.status) && !retry) {
    return existing
  }

  let meetingId = ''
  try {
    const manifest = JSON.parse(await readFile(recordingManifestPath(recordingsDir, recordingId), 'utf8'))
    meetingId = String(manifest.meetingId || '')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const job = {
    id: safeRecordingId(recordingId),
    meetingId: existing?.meetingId || meetingId,
    status: 'queued',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    error: '',
    result: null,
    attempt: Number(existing?.attempt || 0) + 1
  }
  await writeRecordingJob({ recordingsDir, recordingId: job.id, job })
  void enqueueRecordingJob(() => processRecordingJob({
      recordingsDir,
      recordingId: job.id,
      asrBaseUrl,
      fetchImpl,
      summarizeFn,
      summarizeRecording
    }), asrBaseUrl)
  return job
}

export async function startAudioUploadJob({
  recordingsDir,
  uploadId,
  asrBaseUrl,
  fetchImpl = globalThis.fetch,
  now = new Date(),
  retry = false
}) {
  const id = safeRecordingId(uploadId)
  const existing = await readRecordingJob({ recordingsDir, recordingId: id })
  if (existing && ['queued', 'processing', 'completed'].includes(existing.status) && !retry) {
    return existing
  }

  const manifest = JSON.parse(await readFile(audioUploadManifestPath(recordingsDir, id), 'utf8'))
  const job = {
    id,
    sourceType: 'uploaded',
    sourceFilename: manifest.filename,
    meetingId: manifest.meetingId || '',
    status: 'queued',
    createdAt: existing?.createdAt || now.toISOString(),
    updatedAt: now.toISOString(),
    error: '',
    result: null,
    attempt: Number(existing?.attempt || 0) + 1
  }
  await writeRecordingJob({ recordingsDir, recordingId: id, job })
  void enqueueRecordingJob(() => processRecordingJob({
      recordingsDir,
      recordingId: id,
      asrBaseUrl,
      fetchImpl,
      summarizeRecording: false
    }), asrBaseUrl)
  return job
}

export async function retryRecordingJob({
  recordingsDir,
  recordingId,
  asrBaseUrl,
  fetchImpl = globalThis.fetch,
  summarizeFn
}) {
  const existing = await readRecordingJob({ recordingsDir, recordingId })
  if (!existing) throw new Error('Recording job not found.')

  if (existing.sourceType === 'uploaded') {
    return startAudioUploadJob({
      recordingsDir,
      uploadId: recordingId,
      asrBaseUrl,
      fetchImpl,
      retry: true
    })
  }

  return startRecordingJob({
    recordingsDir,
    recordingId,
    asrBaseUrl,
    fetchImpl,
    summarizeFn,
    summarizeRecording: false,
    retry: true
  })
}

export async function listRecordingJobs({ recordingsDir, meetingId = '' }) {
  if (!meetingId) return []

  const entries = await readdir(recordingsDir, { withFileTypes: true })
  const jobs = []
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-zA-Z0-9_-]+$/.test(entry.name)) continue
    const job = await readRecordingJob({ recordingsDir, recordingId: entry.name })
    if (job?.meetingId === meetingId) jobs.push(job)
  }
  return jobs.sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))
}
