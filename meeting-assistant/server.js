import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { DOCX_MIME_TYPE, meetingToDocxBlob, monthToDocxBlob } from './functions/_shared/docxExport.js'
import { downloadContentDisposition } from './functions/_shared/meetings.js'
import {
  finalizeUploadedAudioFile,
  listRecordingJobs,
  readRecordingJob,
  retryRecordingJob,
  saveRecordingChunk,
  saveUploadedAudioChunk,
  startAudioUploadJob,
  startAudioUploadSession,
  startRecordingJob,
  startRecordingSession
} from './server/localRecording.js'
import { buildSummarizerOptions, summarizeWithOllama } from './server/ollamaSummarizer.js'
import { proxyAsrTranscription } from './server/asrProxy.js'
import { requireAccessToken } from './serverAuth.js'
import { registerSummaryRoutes } from './server/summaryRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3001
const ASR_BASE_URL = process.env.ASR_BASE_URL || 'http://127.0.0.1:8000'
const AUDIO_UPLOAD_CHUNK_LIMIT = '20mb'

app.use(cors())
app.use(express.json())
app.use('/api', requireAccessToken)

app.get('/health', requireAccessToken, (req, res) => {
  res.json({
    ok: true,
    service: 'meeting-assistant-model',
    asrBaseUrl: ASR_BASE_URL,
    summarizerModel: buildSummarizerOptions(process.env).model
  })
})

app.post('/transcribe', requireAccessToken, express.raw({ type: '*/*', limit: '200mb' }), async (req, res) => {
  try {
    const response = await proxyAsrTranscription({
      body: Buffer.from(req.body || []),
      contentType: req.get('Content-Type') || 'application/octet-stream',
      asrBaseUrl: ASR_BASE_URL
    })
    res.status(response.status)
    response.headers.forEach((value, key) => {
      res.setHeader(key, value)
    })
    res.send(Buffer.from(await response.arrayBuffer()))
  } catch (error) {
    console.error('ASR 转写代理失败:', error)
    res.status(502).json({
      message: error?.message || 'ASR 服务不可用，请确认本机 ASR 服务已启动'
    })
  }
})

// 生产模式下提供静态文件
const distPath = path.join(__dirname, 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
}

// 数据目录
const DATA_DIR = path.join(__dirname, 'data')
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const RECORDINGS_DIR = process.env.MEETING_RECORDINGS_DIR || path.join(__dirname, 'recordings')
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true })
}

// 工具函数
function getMonthFile(year, month) {
  const mm = String(month).padStart(2, '0')
  return path.join(DATA_DIR, `${year}-${mm}.json`)
}

function readMeetings(year, month) {
  const file = getMonthFile(year, month)
  if (!fs.existsSync(file)) return []
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function writeMeetings(year, month, meetings) {
  const file = getMonthFile(year, month)
  fs.writeFileSync(file, JSON.stringify(meetings, null, 2), 'utf-8')
}

function meetingToMarkdown(m) {
  const lines = []
  lines.push(`# ${m.title}`)
  lines.push('')
  lines.push(`- **日期**: ${m.date}`)
  if (m.startTime || m.endTime) {
    lines.push(`- **时间**: ${m.startTime || ''} ${m.endTime ? '- ' + m.endTime : ''}`)
  }
  if (m.attendees?.length) {
    lines.push(`- **参会人**: ${m.attendees.join('、')}`)
  }
  lines.push('')
  lines.push('---')
  lines.push('')

  // 直接输出自由书写的内容
  if (m.content) {
    lines.push(m.content)
    lines.push('')
  }

  return lines.join('\n')
}

// ===== API 路由 =====

app.get('/api/local/health', (req, res) => {
  res.json({
    ok: true,
    service: 'MeetingRecord Local Agent',
    recordingsDir: RECORDINGS_DIR,
    asrBaseUrl: ASR_BASE_URL,
    summarizerModel: buildSummarizerOptions(process.env).model
  })
})

app.post('/api/local/recordings/start', async (req, res) => {
  try {
    const session = await startRecordingSession({
      recordingsDir: RECORDINGS_DIR,
      title: req.body?.title || '',
      meetingId: req.body?.meetingId || ''
    })
    res.status(201).json(session)
  } catch (error) {
    console.error('Local recording start failed:', error)
    res.status(500).json({ message: error?.message || 'Failed to start local recording.' })
  }
})

app.get('/api/local/recordings', async (req, res) => {
  try {
    res.json(await listRecordingJobs({ recordingsDir: RECORDINGS_DIR, meetingId: req.query.meetingId || '' }))
  } catch (error) {
    console.error('Local recording list failed:', error)
    res.status(500).json({ message: error?.message || 'Failed to list recording jobs.' })
  }
})

app.post('/api/local/uploads/start', async (req, res) => {
  try {
    const session = await startAudioUploadSession({
      recordingsDir: RECORDINGS_DIR,
      filename: req.body?.filename,
      mimeType: req.body?.mimeType,
      size: req.body?.size,
      title: req.body?.title,
      meetingId: req.body?.meetingId || ''
    })
    res.status(201).json(session)
  } catch (error) {
    console.error('Local audio upload start failed:', error)
    res.status(400).json({ message: error?.message || 'Failed to start audio upload.' })
  }
})

app.post('/api/local/uploads/:id/chunks', express.raw({ type: '*/*', limit: AUDIO_UPLOAD_CHUNK_LIMIT }), async (req, res) => {
  try {
    const chunk = await saveUploadedAudioChunk({
      recordingsDir: RECORDINGS_DIR,
      uploadId: req.params.id,
      index: req.query.index,
      data: req.body
    })
    res.status(201).json(chunk)
  } catch (error) {
    console.error('Local audio upload chunk failed:', error)
    res.status(400).json({ message: error?.message || 'Failed to store audio upload chunk.' })
  }
})

app.post('/api/local/uploads/:id/finish', async (req, res) => {
  try {
    await finalizeUploadedAudioFile({
      recordingsDir: RECORDINGS_DIR,
      uploadId: req.params.id,
      chunkCount: req.body?.chunkCount
    })
    const job = await startAudioUploadJob({
      recordingsDir: RECORDINGS_DIR,
      uploadId: req.params.id,
      asrBaseUrl: ASR_BASE_URL
    })
    if (job.status === 'completed') {
      return res.json({ id: job.id, status: 'completed', result: job.result })
    }
    res.status(202).json({ id: job.id, status: job.status, error: job.error || '' })
  } catch (error) {
    console.error('Local audio upload finish failed:', error)
    res.status(400).json({ message: error?.message || 'Failed to finish audio upload.' })
  }
})

app.post('/api/local/recordings/:id/chunks', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  try {
    const chunk = await saveRecordingChunk({
      recordingsDir: RECORDINGS_DIR,
      recordingId: req.params.id,
      index: req.query.index,
      data: req.body,
      mimeType: req.headers['content-type'] || 'audio/webm'
    })
    res.status(201).json({ index: chunk.index, filename: chunk.filename })
  } catch (error) {
    console.error('Local recording chunk failed:', error)
    res.status(400).json({ message: error?.message || 'Failed to store recording chunk.' })
  }
})

app.post('/api/local/recordings/:id/finish', async (req, res) => {
  try {
    const job = await startRecordingJob({
      recordingsDir: RECORDINGS_DIR,
      recordingId: req.params.id,
      asrBaseUrl: ASR_BASE_URL,
      summarizeRecording: false
    })
    if (job.status === 'completed') {
      return res.json({ id: job.id, status: 'completed', result: job.result })
    }
    res.status(202).json({ id: job.id, status: job.status, error: job.error || '' })
  } catch (error) {
    console.error('Local recording finish failed:', error)
    res.status(503).json({ message: error?.message || 'Failed to finish local recording.' })
  }
})

app.post('/api/local/recordings/:id/retry', async (req, res) => {
  try {
    const job = await retryRecordingJob({
      recordingsDir: RECORDINGS_DIR,
      recordingId: req.params.id,
      asrBaseUrl: ASR_BASE_URL
    })
    if (job.status === 'completed') {
      return res.json({ id: job.id, status: 'completed', result: job.result })
    }
    res.status(202).json({ id: job.id, status: job.status, error: job.error || '' })
  } catch (error) {
    console.error('Local recording retry failed:', error)
    res.status(503).json({ message: error?.message || 'Failed to retry local recording.' })
  }
})

app.get('/api/local/recordings/:id/status', async (req, res) => {
  try {
    const job = await readRecordingJob({ recordingsDir: RECORDINGS_DIR, recordingId: req.params.id })
    if (!job) return res.status(404).json({ message: 'Recording job not found.' })
    res.json(job)
  } catch (error) {
    console.error('Local recording status failed:', error)
    res.status(500).json({ message: error?.message || 'Failed to read recording status.' })
  }
})

app.post('/api/summarize', async (req, res) => {
  const content = String(req.body?.content || '').trim()
  if (!content) {
    return res.status(400).json({ message: '没有可整理的转写内容' })
  }

  try {
    const summarizerOptions = buildSummarizerOptions(process.env)
    const summary = await summarizeWithOllama(content, summarizerOptions)
    res.json({ summary, model: summarizerOptions.model })
  } catch (error) {
    console.error('LLM 纪要整理失败:', error)
    res.status(503).json({
      message: error?.message || 'LLM 服务不可用，请确认 Ollama 已启动并已拉取模型'
    })
  }
})

registerSummaryRoutes(app)

// 获取指定月份的会议列表
app.get('/api/meetings', (req, res) => {
  const month = req.query.month
  if (!month) return res.status(400).json({ message: '缺少 month 参数' })

  const [year, mon] = month.split('-').map(Number)
  const meetings = readMeetings(year, mon)
  res.json(meetings)
})

// 获取单个会议
app.get('/api/meetings/:id', (req, res) => {
  // 搜索所有月份文件
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
  for (const file of files) {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
    const meetings = JSON.parse(raw)
    const found = meetings.find(m => m.id === req.params.id)
    if (found) return res.json(found)
  }
  res.status(404).json({ message: '会议不存在' })
})

// 创建会议
app.post('/api/meetings', (req, res) => {
  const { date, title, startTime, endTime, attendees, content } = req.body

  if (!date || !title) {
    return res.status(400).json({ message: '日期和标题为必填项' })
  }

  const [year, month] = date.substring(0, 7).split('-').map(Number)
  const meetings = readMeetings(year, month)

  const now = new Date().toISOString()
  const meeting = {
    id: randomUUID(),
    title: title.trim(),
    date,
    startTime: startTime || '',
    endTime: endTime || '',
    attendees: attendees || [],
    content: content || '',
    createdAt: now,
    updatedAt: now
  }

  meetings.push(meeting)
  writeMeetings(year, month, meetings)
  res.status(201).json(meeting)
})

// 更新会议
app.put('/api/meetings/:id', (req, res) => {
  const { date } = req.body
  if (!date) return res.status(400).json({ message: '缺少日期' })

  const [year, month] = date.substring(0, 7).split('-').map(Number)
  const meetings = readMeetings(year, month)

  const index = meetings.findIndex(m => m.id === req.params.id)
  if (index === -1) return res.status(404).json({ message: '会议不存在' })

  meetings[index] = {
    ...meetings[index],
    ...req.body,
    id: meetings[index].id,
    createdAt: meetings[index].createdAt,
    updatedAt: new Date().toISOString()
  }

  writeMeetings(year, month, meetings)
  res.json(meetings[index])
})

// 删除会议
app.delete('/api/meetings/:id', (req, res) => {
  // 搜索所有月份文件
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const meetings = JSON.parse(raw)
    const index = meetings.findIndex(m => m.id === req.params.id)
    if (index !== -1) {
      meetings.splice(index, 1)
      fs.writeFileSync(filePath, JSON.stringify(meetings, null, 2), 'utf-8')
      return res.json({ success: true })
    }
  }
  res.status(404).json({ message: '会议不存在' })
})

// 导出单个会议
app.get('/api/meetings/:id/export', async (req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
  for (const file of files) {
    const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
    const meetings = JSON.parse(raw)
    const found = meetings.find(m => m.id === req.params.id)
    if (found) {
      const format = String(req.query.format || 'md').toLowerCase()
      if (format === 'docx') {
        const blob = await meetingToDocxBlob(found)
        const buffer = Buffer.from(await blob.arrayBuffer())
        res.setHeader('Content-Type', DOCX_MIME_TYPE)
        res.setHeader('Content-Disposition', downloadContentDisposition(`会议纪要-${found.title}-${found.date}.docx`))
        return res.send(buffer)
      }

      const md = meetingToMarkdown(found)
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
      res.setHeader('Content-Disposition', downloadContentDisposition(`会议纪要-${found.title}-${found.date}.md`))
      return res.send(md)
    }
  }
  res.status(404).json({ message: '会议不存在' })
})

// 导出整月会议
app.get('/api/meetings/export/month', async (req, res) => {
  const month = req.query.month
  if (!month) return res.status(400).json({ message: '缺少 month 参数' })

  const [year, mon] = month.split('-').map(Number)
  const meetings = readMeetings(year, mon)

  const lines = []
  lines.push(`# 会议纪要月报 - ${year}年${mon}月`)
  lines.push('')
  lines.push(`共 ${meetings.length} 场会议`)
  lines.push('')

  // 按日期排序
  meetings.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))

  const format = String(req.query.format || 'md').toLowerCase()
  if (format === 'docx') {
    const blob = await monthToDocxBlob({ year, month: mon, meetings })
    const buffer = Buffer.from(await blob.arrayBuffer())
    res.setHeader('Content-Type', DOCX_MIME_TYPE)
    res.setHeader('Content-Disposition', downloadContentDisposition(`会议纪要月报-${year}年${mon}月.docx`))
    return res.send(buffer)
  }

  for (const m of meetings) {
    lines.push('---')
    lines.push('')
    lines.push(meetingToMarkdown(m))
  }

  const md = lines.join('\n')
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
  res.setHeader('Content-Disposition', downloadContentDisposition(`会议纪要月报-${year}年${mon}月.md`))
  res.send(md)
})

// 生产模式下，SPA 回退
if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'))
    }
  })
}

app.listen(PORT, () => {
  console.log(`会议记录助手服务已启动: http://localhost:${PORT}`)
})
