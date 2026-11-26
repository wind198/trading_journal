import type { IChartApi, Time } from 'lightweight-charts'

export type BarTimeSeries = readonly { time: number }[]

export function barIntervalSec(bars: BarTimeSeries): number | null {
  if (bars.length < 2) return null
  const dt = bars[bars.length - 1].time - bars[bars.length - 2].time
  return dt > 0 ? dt : null
}

/** Float bar index for a unix time (extrapolates beyond loaded bars). */
export function logicalIndexAtTime(timeSec: number, bars: BarTimeSeries): number | null {
  if (!Number.isFinite(timeSec) || timeSec <= 0 || bars.length === 0) return null
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

  if (i0 < 0) return bars[0]!.time + logical * (bars[1]!.time - bars[0]!.time)
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

/** Actual pixel coordinate of a timestamp already present on the chart. */
function coordinateAt(chart: IChartApi, time: number): number | null {
  const value = chart.timeScale().timeToCoordinate(time as Time)
  return value != null && Number.isFinite(value) ? Number(value) : null
}

/** Locate adjacent rendered timestamps by pixel coordinate (including offscreen extrapolation). */
function pixelBracket(chart: IChartApi, x: number, bars: BarTimeSeries): number | null {
  if (bars.length < 2) return null
  let lo = 0, hi = bars.length - 1
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    const px = coordinateAt(chart, bars[mid]!.time)
    if (px == null) return null
    if (px <= x) lo = mid
    else hi = mid
  }
  return lo
}

/** Time at pixel x, using actual rendered slots rather than rounded logical indices. */
export function timeAtChartX(chart: IChartApi, x: number, bars: BarTimeSeries): number | null {
  if (!Number.isFinite(x)) return null
  const scale = chart.timeScale()
  // Some lightweight test adapters expose only logical coordinates.
  if (typeof scale.timeToCoordinate === 'function' && bars.length >= 2) {
    const i = pixelBracket(chart, x, bars)
    if (i == null) return null
    const t0 = bars[i]!.time, t1 = bars[i+1]!.time
    const a = coordinateAt(chart,t0), b = coordinateAt(chart,t1)
    if (a == null || b == null || b <= a || t1 <= t0) return null
    const time = t0 + (x-a)/(b-a)*(t1-t0)
    return Number.isFinite(time) && time > 0 ? time : null
  }
  const logical = scale.coordinateToLogical(x)
  if (logical != null && Number.isFinite(logical)) {
    const t = timeAtLogicalIndex(logical, bars)
    if (t != null && Number.isFinite(t) && t > 0) return t
  }
  const time = asUnixSeconds(scale.coordinateToTime(x))
  return time != null && time > 0 ? time : null
}

/** Pixel x for Unix time. Never substitute logical index zero for an unavailable timestamp. */
export function chartXAtTime(chart: IChartApi, timeSec: number, bars: BarTimeSeries): number | null {
  if (!Number.isFinite(timeSec) || timeSec <= 0) return null
  const direct = coordinateAt(chart,timeSec)
  if (direct != null) return direct
  if (bars.length < 2) return null
  const logical = logicalIndexAtTime(timeSec,bars)
  if (logical == null || !Number.isFinite(logical)) return null
  const lower = Math.max(0,Math.min(bars.length-2,Math.floor(logical)))
  const a = coordinateAt(chart,bars[lower]!.time)
  const b = coordinateAt(chart,bars[lower+1]!.time)
  if (a == null || b == null || b <= a) return null
  const x = a + (logical-lower)*(b-a)
  return Number.isFinite(x) ? x : null
}
