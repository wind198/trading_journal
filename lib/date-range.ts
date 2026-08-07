const TIME_ZONE = 'Asia/Ho_Chi_Minh'

function partsInVn(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(date)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  return { year, month, day }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD for a calendar day in Asia/Ho_Chi_Minh */
export function todayVn(): string {
  const { year, month, day } = partsInVn()
  return `${year}-${pad(month)}-${pad(day)}`
}

/** YYYY-MM-DD for an arbitrary instant in Asia/Ho_Chi_Minh */
export function toVnDateKey(isoOrDate: string | Date): string {
  const { year, month, day } = partsInVn(new Date(isoOrDate))
  return `${year}-${pad(month)}-${pad(day)}`
}

export function formatVnDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${pad(d)}/${pad(m)}`
}

export function formatVnDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return `${pad(d)}/${pad(m)}/${y}`
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d + days)
  const date = new Date(utc)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

function dayOfWeekMon0(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  // UTC noon avoids DST edge cases; VN has no DST
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()
  return dow === 0 ? 6 : dow - 1
}

export function startOfWeekVn(isoDate = todayVn()): string {
  return addDays(isoDate, -dayOfWeekMon0(isoDate))
}

export function startOfMonthVn(isoDate = todayVn()): string {
  const [y, m] = isoDate.split('-')
  return `${y}-${m}-01`
}

export function eachDateInclusive(from: string, to: string): string[] {
  if (from > to) return []
  const dates: string[] = []
  let cursor = from
  while (cursor <= to) {
    dates.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return dates
}

/** Inclusive VN calendar days → UTC ISO bounds for timestamptz filters */
export function vnRangeToUtcBounds(from: string, to: string): { startIso: string; endIso: string } {
  const startIso = `${from}T00:00:00+07:00`
  const endExclusive = addDays(to, 1)
  const endIso = `${endExclusive}T00:00:00+07:00`
  return {
    startIso: new Date(startIso).toISOString(),
    endIso: new Date(endIso).toISOString(),
  }
}

export function rangeToday() {
  const t = todayVn()
  return { from: t, to: t, preset: 'today' as const }
}

export function rangeThisWeek() {
  const t = todayVn()
  return { from: startOfWeekVn(t), to: t, preset: 'week' as const }
}

export function rangeThisMonth() {
  const t = todayVn()
  return { from: startOfMonthVn(t), to: t, preset: 'month' as const }
}
