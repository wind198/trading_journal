import { CHART_TIME_ZONE } from '../chart/chart-timezone'

/** Default note title: `{symbol}_{YYYY-MM-DD}_{HH}_{mm}` in chart timezone. */
export function formatNoteTitle(symbol: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CHART_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''

  const y = get('year')
  const m = get('month')
  const d = get('day')
  const h = get('hour')
  const min = get('minute')

  return `${symbol}_${y}-${m}-${d}_${h}_${min}`
}
