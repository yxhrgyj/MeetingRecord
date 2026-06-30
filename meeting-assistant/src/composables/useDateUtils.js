export function useDateUtils() {
  function today() {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }

  function formatDate(date) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function formatDisplay(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
  }

  function formatMonth(date) {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`
  }

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate()
  }

  function isToday(date) {
    return isSameDay(date, today())
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate()
  }

  function getFirstDayOfMonth(year, month) {
    const day = new Date(year, month, 1).getDay()
    return day === 0 ? 6 : day - 1
  }

  function getMonthGrid(year, month) {
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    const cells = []

    // 上月填充
    const prevMonthDays = getDaysInMonth(year, month - 1)
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false
      })
    }

    // 本月
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        date: new Date(year, month, d),
        isCurrentMonth: true
      })
    }

    // 下月填充
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        date: new Date(year, month + 1, d),
        isCurrentMonth: false
      })
    }

    // 按周分组
    const weeks = []
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7))
    }
    return weeks
  }

  function getWeekDays(date) {
    const start = new Date(date)
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + diff)

    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }

  function addMonths(date, n) {
    const d = new Date(date)
    d.setMonth(d.getMonth() + n)
    return d
  }

  function addWeeks(date, n) {
    const d = new Date(date)
    d.setDate(d.getDate() + n * 7)
    return d
  }

  function addDays(date, n) {
    const d = new Date(date)
    d.setDate(d.getDate() + n)
    return d
  }

  function startOfWeek(date) {
    const d = new Date(date)
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    return d
  }

  function parseDateStr(str) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日']

  return {
    today, formatDate, formatDisplay, formatMonth,
    isSameDay, isToday, getDaysInMonth, getFirstDayOfMonth,
    getMonthGrid, getWeekDays, addMonths, addWeeks, addDays,
    startOfWeek, parseDateStr, WEEKDAY_NAMES
  }
}
