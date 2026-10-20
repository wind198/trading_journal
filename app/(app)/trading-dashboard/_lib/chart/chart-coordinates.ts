import type { IChartApi, Logical, Time } from 'lightweight-charts'

export type BarTimeSeries = readonly { time: number }[]

export function barIntervalSec(bars: BarTimeSeries): number | null {
  if (bars.length < 2) return null
  const dt = bars[bars.length - 1].time - bars[bars.length - 2].time
  return dt > 0 ? dt : null
}

/** Float bar index for a unix time (extrapolates beyond loaded bars). */
export function logicalIndexAtTime(timeSec: number, bars: BarTimeSeries): number | null {
  if (bars.length === 0) return null
  if (bars.length === 1) return timeSec <= bars[0].time ? 0 : 1

  const first = bars[0].time
  const lastIdx = bars.length - 1
  const lastT = bars[lastIdx].time
  const interval = barIntervalSec(bars)
  if (interval == null) return null

  if (timeSec >= lastT) return lastIdx + (timeSec - lastT) / interval

  if (timeSec <= first) {
    const dt0 = bars[1].time - bars[0].time
    if (dt0 <= 0) return 0
    return (timeSec - first) / dt0
  }

  let lo = 0
  let hi = lastIdx
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (bars[mid].time <= timeSec) lo = mid
    else hi = mid - 1
  }
  const t0 = bars[lo].time
  const t1 = lo < lastIdx ? bars[lo + 1].time : t0 + interval
  if (t1 === t0) return lo
  return lo + (timeSec - t0) / (t1 - t0)
}

export function timeAtLogicalIndex(logical: number, bars: BarTimeSeries): number | null {
  if (!Number.isFinite(logical) || bars.length === 0) return null
  if (bars.length === 1) return bars[0].time

  const i0 = Math.floor(logical)
  const frac = logical - i0
  const t0 = bars[Math.max(0, Math.min(bars.length - 1, i0))]?.time
  const t1 = bars[Math.max(0, Math.min(bars.length - 1, i0 + 1))]?.time
  if (t0 == null || t1 == null) return null

  if (i0 < 0) return t0 + logical * (t1 - t0)
  if (i0 >= bars.length - 1) {
    const last = bars.length - 1
    const prev = bars[last - 1].time
    const lastT = bars[last].time
    return lastT + (logical - last) * (lastT - prev)
  }
  return t0 + frac * (t1 - t0)
}

function asUnixSeconds(time: unknown): number | null {
  return typeof time === 'number' && Number.isFinite(time) ? time : null
}

/** Time at pixel x (no bar-center snap; extrapolates in future whitespace). */
export function timeAtChartX(chart: IChartApi, x: number, bars: BarTimeSeries): number | null {
  const logical = chart.timeScale().coordinateToLogical(x)
  if (logical != null && Number.isFinite(logical)) {
    const t = timeAtLogicalIndex(logical, bars)
    if (t != null) return t
  }
  return asUnixSeconds(chart.timeScale().coordinateToTime(x))
}

/** Pixel x for a unix time (extrapolates when LWC timeToCoordinate returns null). */
export function chartXAtTime(chart: IChartApi, timeSec: number, bars: BarTimeSeries): number | null {
  const direct = chart.timeScale().timeToCoordinate(timeSec as Time)
  if (direct != null) return direct
  if (bars.length < 2) return null
  const logical = logicalIndexAtTime(timeSec, bars)
  if (logical == null || !Number.isFinite(logical)) return null
  return chart.timeScale().logicalToCoordinate(logical as Logical)
}
