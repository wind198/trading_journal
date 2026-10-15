/** Port of TradingView library ForceCandles. Thresholds stay 0..1. */

export type CandleMetrics = {
  candleRange: number
  bodySize: number
  /** 0 = close at low, 100 = close at high */
  closePosition: number
  bodyPercent: number
  upperWickPercent: number
  lowerWickPercent: number
}

export type ForceCandleConfig = {
  lookback: number
  minRangePercentile: number
  minClosePos: number
  maxClosePos: number
  minBodyPct: number
  minRejectionWickPct: number
}

export const DEFAULT_FORCE_CANDLE_CONFIG: ForceCandleConfig = {
  lookback: 100,
  minRangePercentile: 70,
  minClosePos: 0.7,
  maxClosePos: 0.3,
  minBodyPct: 0.5,
  minRejectionWickPct: 0.25,
}

export function calculateMetrics(
  srcHigh: number,
  srcLow: number,
  srcOpen: number,
  srcClose: number,
): CandleMetrics {
  const candleRange = srcHigh - srcLow
  const bodySize = Math.abs(srcClose - srcOpen)
  const upperWick = srcHigh - Math.max(srcOpen, srcClose)
  const lowerWick = Math.min(srcOpen, srcClose) - srcLow
  const closePosition = candleRange > 0 ? ((srcClose - srcLow) / candleRange) * 100 : 50
  const bodyPercent = candleRange > 0 ? (bodySize / candleRange) * 100 : 0
  const upperWickPercent = candleRange > 0 ? (upperWick / candleRange) * 100 : 0
  const lowerWickPercent = candleRange > 0 ? (lowerWick / candleRange) * 100 : 0
  return {
    candleRange,
    bodySize,
    closePosition,
    bodyPercent,
    upperWickPercent,
    lowerWickPercent,
  }
}

/**
 * Pine `ta.percentile_nearest_rank`: nearest-rank percentile of `values`.
 * `percentage` is 0..100. Returns null if empty.
 */
export function percentileNearestRank(values: readonly number[], percentage: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const rank = Math.max(1, Math.ceil((percentage / 100) * n))
  return sorted[rank - 1]!
}

export function calculateForceSignals(
  srcHigh: number,
  srcLow: number,
  srcOpen: number,
  srcClose: number,
  recentRanges: readonly number[],
  config: ForceCandleConfig,
): { bullishForce: boolean; bearishForce: boolean } {
  const metrics = calculateMetrics(srcHigh, srcLow, srcOpen, srcClose)
  const bodyPct = metrics.bodyPercent / 100
  const upperWickPct = metrics.upperWickPercent / 100
  const lowerWickPct = metrics.lowerWickPercent / 100
  const closePos = metrics.closePosition / 100

  const ranges = [...recentRanges, metrics.candleRange]
  const window =
    ranges.length > config.lookback ? ranges.slice(ranges.length - config.lookback) : ranges
  const rangePercentile = percentileNearestRank(window, config.minRangePercentile)
  const rangeOk = rangePercentile != null && metrics.candleRange >= rangePercentile

  const bullishImpulse = srcClose > srcOpen && bodyPct >= config.minBodyPct
  const bullishRejection =
    lowerWickPct >= config.minRejectionWickPct && bodyPct >= config.minBodyPct
  const bullishForce =
    rangeOk && closePos >= config.minClosePos && (bullishImpulse || bullishRejection)

  const bearishImpulse = srcClose < srcOpen && bodyPct >= config.minBodyPct
  const bearishRejection =
    upperWickPct >= config.minRejectionWickPct && bodyPct >= config.minBodyPct
  const bearishForce =
    rangeOk && closePos <= config.maxClosePos && (bearishImpulse || bearishRejection)

  return { bullishForce, bearishForce }
}
