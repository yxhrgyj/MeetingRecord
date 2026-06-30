import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')
const dataDir = path.join(root, 'data')
const migrationsDir = path.join(root, 'migrations')
const outputFile = path.join(migrationsDir, 'seed-from-json.sql')

function sqlString(value) {
  return `'${String(value ?? '').replaceAll("'", "''")}'`
}

function normalizeMeeting(meeting) {
  const attendees = Array.isArray(meeting.attendees)
    ? meeting.attendees.map(name => String(name).trim()).filter(Boolean)
    : []

  return {
    id: String(meeting.id),
    title: String(meeting.title || '').trim(),
    date: String(meeting.date || ''),
    startTime: String(meeting.startTime || ''),
    endTime: String(meeting.endTime || ''),
    attendeesJson: JSON.stringify(attendees),
    content: String(meeting.content || ''),
    createdAt: String(meeting.createdAt || new Date().toISOString()),
    updatedAt: String(meeting.updatedAt || meeting.createdAt || new Date().toISOString())
  }
}

if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true })
}

const files = fs.existsSync(dataDir)
  ? fs.readdirSync(dataDir).filter(file => file.endsWith('.json')).sort()
  : []

const rows = []
for (const file of files) {
  const filePath = path.join(dataDir, file)
  const meetings = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  for (const meeting of meetings) {
    const row = normalizeMeeting(meeting)
    if (!row.id || !row.title || !row.date) continue
    rows.push(row)
  }
}

const lines = []

for (const row of rows) {
  lines.push(`INSERT OR REPLACE INTO meetings (id, title, date, startTime, endTime, attendeesJson, content, createdAt, updatedAt) VALUES (${[
    row.id,
    row.title,
    row.date,
    row.startTime,
    row.endTime,
    row.attendeesJson,
    row.content,
    row.createdAt,
    row.updatedAt
  ].map(sqlString).join(', ')});`)
}

lines.push('')

fs.writeFileSync(outputFile, lines.join('\n'), 'utf-8')
console.log(`Generated ${path.relative(root, outputFile)} with ${rows.length} meetings.`)
