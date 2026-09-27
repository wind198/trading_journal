import type { LightweightCandle } from './candles'

export interface BaseLineBiasConfig {
  baseLineLength: number
  analysisLength: number
  thresholdPercent: number
}

export const DEFAULT_BASE_LINE_BIAS_CONFIG: BaseLineBiasConfig = {
  baseLineLength: 52,
  analysisLength: 75,
  thresholdPercent: 80,
}

export interface BaseLineBiasPoint {
  time: number
  value: -1 | 0 | 1
  bullishPercent: number
  bearishPercent: number
  bullishCount: number
  bearishCount: number
  baseLine: number
}

function donchianMid(
  bars: readonly LightweightCandle[],
  index: number,
  length: number,
): number | null {
  if (index < length - 1) return null
  let high = -Infinity
  let low = Infinity
  for (let i = index - length + 1; i <= index; i++) {
    high = Math.max(high, bars[i].high)
    low = Math.min(low, bars[i].low)
  }
  return (high + low) / 2
}

function assertConfig(config: BaseLineBiasConfig): void {
  if (!Number.isInteger(config.baseLineLength) || config.baseLineLength < 1) {
    throw new RangeError('baseLineLength must be an integer >= 1')
  }
  if (!Number.isInteger(config.analysisLength) || config.analysisLength < 1) {
    throw new RangeError('analysisLength must be an integer >= 1')
  }
  if (
    !Number.isFinite(config.thresholdPercent) ||
    config.thresholdPercent < 50 ||
    config.thresholdPercent > 100
  ) {
    throw new RangeError('thresholdPercent must be between 50 and 100')
  }
}

export function calculateBaseLineBias(
  bars: readonly LightweightCandle[],
  config: BaseLineBiasConfig = DEFAULT_BASE_LINE_BIAS_CONFIG,
): BaseLineBiasPoint[] {
  assertConfig(config)
  const { baseLineLength, analysisLength, thresholdPercent } = config
  const baseLines: (number | null)[] = new Array(bars.length)
  for (let i = 0; i < bars.length; i++) {
    baseLines[i] = donchianMid(bars, i, baseLineLength)
  }

  const points: BaseLineBiasPoint[] = []
  // Window start must already have a base line: i - analysisLength + 1 >= baseLineLength - 1
  const firstComplete = baseLineLength + analysisLength - 2

  for (let i = firstComplete; i < bars.length; i++) {
    const windowStart = i - analysisLength + 1
    if (windowStart < 0) continue
    const baseLine = baseLines[i]
    if (baseLine == null) continue

    let bullishCount = 0
    let bearishCount = 0
    let valid = true
    for (let j = windowStart; j <= i; j++) {
      const line = baseLines[j]
      if (line == null) {
        valid = false
        break
      }
      const close = bars[j].close
      if (close > line) bullishCount++
      else if (close < line) bearishCount++
    }
    if (!valid) continue

    const bullishPercent = (bullishCount / analysisLength) * 100
    const bearishPercent = (bearishCount / analysisLength) * 100
    const value: -1 | 0 | 1 =
      bullishPercent >= thresholdPercent ? 1 : bearishPercent >= thresholdPercent ? -1 : 0

    points.push({
      time: bars[i].time,
      value,
      bullishPercent,
      bearishPercent,
      bullishCount,
      bearishCount,
      baseLine,
    })
  }

  return points
}
