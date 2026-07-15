export function canAutoSaveMeeting({ title, date, summary, transcript } = {}) {
  return Boolean(
    String(title || '').trim() &&
    String(date || '').trim() &&
    (String(summary || '').trim() || String(transcript || '').trim())
  )
}
