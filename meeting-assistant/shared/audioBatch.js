function reindex(items) {
  return items.map((item, index) => ({ ...item, index }))
}

export function createAudioBatchItems(files = []) {
  return reindex(
    Array.from(files)
      .filter(file => Number(file?.size) > 0)
      .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), undefined, {
        numeric: true,
        sensitivity: 'base'
      }))
      .map((file, sequence) => ({
        id: `${file.name}-${file.size}-${file.lastModified || ''}-${sequence}`,
        filename: String(file.name || 'audio'),
        file,
        status: 'selected',
        transcript: '',
        error: ''
      }))
  )
}

export function moveAudioBatchItem(items = [], fromIndex, toIndex) {
  const next = Array.from(items, item => ({ ...item }))
  const source = Number(fromIndex)
  const target = Number(toIndex)
  if (!Number.isInteger(source) || !Number.isInteger(target) || source < 0 || target < 0 || source >= next.length || target >= next.length) {
    return reindex(next)
  }

  const [item] = next.splice(source, 1)
  next.splice(target, 0, item)
  return reindex(next)
}

export async function runAudioBatch({ items = [], transcribeFile, metadata = {}, onItem = () => {} } = {}) {
  if (typeof transcribeFile !== 'function') throw new Error('A batch transcriber is required.')

  const next = reindex(items)
  for (const item of next) {
    if (item.status === 'completed') continue
    if (item.status === 'failed') break

    item.status = 'uploading'
    item.error = ''
    onItem({ ...item })

    try {
      const result = await transcribeFile(item.file, metadata, {
        onStatus(job) {
          onItem({ ...item, status: job?.status || item.status, error: job?.error || '' })
        }
      })
      item.status = 'completed'
      item.transcript = String(result?.transcript || '').trim()
      onItem({ ...item })
    } catch (error) {
      item.status = 'failed'
      item.error = error?.message || 'Audio transcription failed.'
      onItem({ ...item })
      break
    }
  }

  return next
}

export function formatCompletedAudioBatch(items = []) {
  return reindex(items)
    .filter(item => item.status === 'completed' && String(item.transcript || '').trim())
    .map(item => `## ${item.filename}\n\n${String(item.transcript).trim()}`)
    .join('\n\n')
}
