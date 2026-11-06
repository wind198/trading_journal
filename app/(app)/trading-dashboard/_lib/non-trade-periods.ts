import { CHART_TIME_ZONE } from './chart/chart-timezone'

/** Minutes from midnight in CHART_TIME_ZONE. Inclusive start/end. */
export const NON_TRADE_PERIODS = [
  { start: 9 * 60 + 30, end: 11 * 60 + 45, label: '09:30–11:45' },
  { start: 14 * 60 + 30, end: 19 * 60 + 35, label: '14:30–19:35' },
] as const

function minutesOfDayInChartZone(nowMs: number): number {
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

export function activeNonTradePeriod(
  nowMs = Date.now(),
): (typeof NON_TRADE_PERIODS)[number] | null {
  const minutes = minutesOfDayInChartZone(nowMs)
  for (const period of NON_TRADE_PERIODS) {
    if (minutes >= period.start && minutes <= period.end) return period
  }
  return null
}

export function isInNonTradePeriod(nowMs = Date.now()): boolean {
  return activeNonTradePeriod(nowMs) != null
}
