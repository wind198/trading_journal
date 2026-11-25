/**
 * Chart axis / crosshair time display timezone (IANA).
 * Override with NEXT_PUBLIC_CHART_TIME_ZONE (e.g. Asia/Ho_Chi_Minh = UTC+7).
 */
export const CHART_TIME_ZONE =
  process.env.NEXT_PUBLIC_CHART_TIME_ZONE?.trim() || 'Asia/Ho_Chi_Minh'

/** Minutes from midnight in CHART_TIME_ZONE. */
export function minutesOfDayInChartZone(nowMs = Date.now()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CHART_TIME_ZONE,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs))
  let hour = 0
  let minute = 0
  for (const part of parts) {
    if (part.type === 'hour') hour = Number(part.value)
    if (part.type === 'minute') minute = Number(part.value)
  }
  return hour * 60 + minute
}

/** Matches lightweight-charts TickMarkType numeric values. */
export const ChartTickMarkType = {
  Year: 0,
  Month: 1,
  DayOfMonth: 2,
  Time: 3,
  TimeWithSeconds: 4,
} as const

function asUnixSeconds(time: unknown): number | null {
  if (typeof time === 'number' && Number.isFinite(time)) return time
  if (time && typeof time === 'object' && 'timestamp' in time) {
    const ts = (time as { timestamp: unknown }).timestamp
    if (typeof ts === 'number' && Number.isFinite(ts)) return ts
  }
  return null
}

function partMap(unixSec: number, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CHART_TIME_ZONE,
    ...options,
  }).formatToParts(new Date(unixSec * 1000))
  const out: Record<string, string> = {}
  for (const part of parts) {
    if (part.type !== 'literal') out[part.type] = part.value
  }
  return out
}

/** Crosshair / tooltip time label in configured zone. */
export function formatChartCrosshairTime(time: unknown): string {
  const unix = asUnixSeconds(time)
  if (unix == null) return ''
  const p = partMap(unix, {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${p.day} ${p.month} ${p.year} ${p.hour}:${p.minute}`
}

/** Time-scale tick label in configured zone. Keep short (LWC ≤8 chars ideal). */
export function formatChartTickMark(time: unknown, tickMarkType: number): string | null {
  const unix = asUnixSeconds(time)
  if (unix == null) return null

  if (tickMarkType === ChartTickMarkType.Year) {
    return partMap(unix, { year: 'numeric' }).year
  }
  if (tickMarkType === ChartTickMarkType.Month) {
    const p = partMap(unix, { month: 'short' })
    return p.month
  }
  if (tickMarkType === ChartTickMarkType.DayOfMonth) {
    const p = partMap(unix, { day: '2-digit', month: 'short' })
    return `${p.day} ${p.month}`
  }
  if (tickMarkType === ChartTickMarkType.TimeWithSeconds) {
    const p = partMap(unix, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
    return `${p.hour}:${p.minute}:${p.second}`
  }
  // Time
  const p = partMap(unix, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return `${p.hour}:${p.minute}`
}

/** Wall-clock instant in CHART_TIME_ZONE → Unix seconds (chart candle time). */
export function unixAtChartZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): number {
  let unix = Date.UTC(year, month - 1, day, hour, minute, 0) / 1000
  for (let i = 0; i < 5; i++) {
    const p = partMap(unix, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const gotY = Number(p.year)
    const gotM = Number(p.month)
    const gotD = Number(p.day)
    const gotH = Number(p.hour)
    const gotMin = Number(p.minute)
    if (gotY === year && gotM === month && gotD === day && gotH === hour && gotMin === minute) {
      return unix
    }
    const deltaSec =
      (Date.UTC(year, month - 1, day, hour, minute, 0) -
        Date.UTC(gotY, gotM - 1, gotD, gotH, gotMin, 0)) /
      1000
    unix += deltaSec
  }
  return unix
}

export const SESSION_LINE_SLOTS = [
  { id: 'sydney', label: 'Sydney', hour: 4, minute: 0, color: '#7C3AED' },
  { id: 'tokyo', label: 'Tokyo', hour: 7, minute: 0, color: '#DC2626' },
  { id: 'london', label: 'London', hour: 14, minute: 0, color: '#2563EB' },
  { id: 'newyork', label: 'New York', hour: 19, minute: 30, color: '#059669' },
] as const
export type SessionLineSlot = (typeof SESSION_LINE_SLOTS)[number]
export type SessionSlotId = SessionLineSlot['id']
export type SessionOpenTime = { hour: number; minute: number }
export type SessionOpenTimes = Record<SessionSlotId, SessionOpenTime>
export function sessionSlotId(slot: SessionLineSlot): SessionSlotId { return slot.id }
export function formatSessionOpenTime(time: SessionOpenTime): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
}
export function sessionSlotLabel(slot: SessionLineSlot): string { return slot.label }
export function defaultSessionOpenTimes(): SessionOpenTimes {
  return Object.fromEntries(SESSION_LINE_SLOTS.map(slot => [slot.id, { hour: slot.hour, minute: slot.minute }])) as SessionOpenTimes
}
export function normalizeSessionOpenTimes(raw: unknown): SessionOpenTimes {
  const result = defaultSessionOpenTimes()
  if (!raw || typeof raw !== 'object') return result
  for (const { id } of SESSION_LINE_SLOTS) {
    const time = (raw as Record<string, unknown>)[id] as Partial<SessionOpenTime> | undefined
    if (time && Number.isInteger(time.hour) && Number.isInteger(time.minute) &&
        time.hour! >= 0 && time.hour! <= 23 && time.minute! >= 0 && time.minute! <= 59) {
      result[id] = { hour: time.hour!, minute: time.minute! }
    }
  }
  return result
}
export function parseSessionOpenTime(value: string): SessionOpenTime | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  const [hour, minute] = value.split(':').map(Number)
  return { hour: hour!, minute: minute! }
}
export function defaultSessionSlotEnabled(): Record<SessionSlotId, boolean> {
  return { sydney: true, tokyo: true, london: true, newyork: true }
}

const SESSION_DAY_OFFSETS = [-2, -1, 0, 1] as const

export function chartZoneYmdFromDate(date: Date): { year: number; month: number; day: number } {
  const nowSec = Math.floor(date.getTime() / 1000)
  const p = partMap(nowSec, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return { year: Number(p.year), month: Number(p.month), day: Number(p.day) }
}

/** Start of next calendar day in CHART_TIME_ZONE (exclusive end of “today”). */
export function chartZoneStartOfNextDayUnix(fromDate: Date = new Date()): number {
  const today = chartZoneYmdFromDate(fromDate)
  const next = addCalendarDays(today.year, today.month, today.day, 1)
  return unixAtChartZone(next.year, next.month, next.day, 0, 0)
}

function addCalendarDays(year: number, month: number, day: number, deltaDays: number) {
  const d = new Date(Date.UTC(year, month - 1, day + deltaDays))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/**
 * Session verticals for today−2 … today+1 in chart zone.
 * `enabled` null/undefined keeps every slot; otherwise only ids present in the set.
 */
export type SessionVerticalLine = { time: number; id: SessionSlotId; label: string; color: string }
export function sessionVerticalLines(
  enabled?: ReadonlySet<string> | null,
  openTimes: SessionOpenTimes = defaultSessionOpenTimes(),
  fromDate: Date = new Date(),
): SessionVerticalLine[] {
  const today = chartZoneYmdFromDate(fromDate)
  const lines: SessionVerticalLine[] = []
  for (const offset of SESSION_DAY_OFFSETS) {
    const { year, month, day } = addCalendarDays(today.year, today.month, today.day, offset)
    for (const slot of SESSION_LINE_SLOTS) {
      if (enabled && !enabled.has(slot.id)) continue
      const { hour, minute } = openTimes[slot.id]
      lines.push({ time: unixAtChartZone(year, month, day, hour, minute), id: slot.id, label: slot.label, color: slot.color })
    }
  }
  return lines.sort((a,b) => a.time-b.time)
}
export function sessionVerticalLineTimes(enabled?: ReadonlySet<string> | null, openTimes?: SessionOpenTimes): number[] {
  return sessionVerticalLines(enabled, openTimes).map(line => line.time)
}
