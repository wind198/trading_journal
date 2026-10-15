/**
 * Chart axis / crosshair time display timezone (IANA).
 * Override with NEXT_PUBLIC_CHART_TIME_ZONE (e.g. Asia/Ho_Chi_Minh = UTC+7).
 */
export const CHART_TIME_ZONE =
  process.env.NEXT_PUBLIC_CHART_TIME_ZONE?.trim() || 'Asia/Ho_Chi_Minh'

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
