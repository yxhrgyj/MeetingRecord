export function canAutoSaveMeeting({ title, date } = {}) {
  return Boolean(
    String(title || '').trim() &&
    String(date || '').trim()
  )
}
