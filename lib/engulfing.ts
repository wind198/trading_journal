/** Port of TradingView library EngulfingDetector. */

import { percentileNearestRank } from './force-candles'
import type { LightweightCandle } from './ticks/candles'

export const EngulfingDirection = {
  Bullish: 'BULLISH',
  Bearish: 'BEARISH',
} as const
export type EngulfingDirection = (typeof EngulfingDirection)[keyof typeof EngulfingDirection]

export type EngulfingConfig = {
  lookback: number
  forcePercentile: number
  engulfPercent: number
}

/** Defaults from indicator UI (percentile 65, not library 60). */
export const DEFAULT_ENGULFING_CONFIG: EngulfingConfig = {
  lookback: 100,
  forcePercentile: 65,
  engulfPercent: 70,
}

export type EngulfingEvent = {
  barIndex: number
  time: number
  direction: EngulfingDirection
  srcOpen: number
  srcHigh: number
  srcLow: number
  srcClose: number
}

export type EngulfingSignals = {
  bullishBodyEngulfing: boolean
  bearishBodyEngulfing: boolean
  forceQualified: boolean
  bullishSignal: boolean
  bearishSignal: boolean
  engulfPercentAchieved: number
  rangePercentile: number | null
}

/**
 * One-bar engulfing + force-range check.
 * `priorRanges` = candle ranges of bars before the current (Pine currentRange[1] window).
 */
export function calculateEngulfingSignals(
  srcHigh: number,
  srcLow: number,
  srcOpen: number,
  srcClose: number,
  previousOpen: number,
  previousClose: number,
  priorRanges: readonly number[],
  config: EngulfingConfig = DEFAULT_ENGULFING_CONFIG,
): EngulfingSignals {
  const currentRange = srcHigh - srcLow
  const previousBodyHigh = Math.max(previousOpen, previousClose)
  const previousBodyLow = Math.min(previousOpen, previousClose)
  const previousBodySize = previousBodyHigh - previousBodyLow

  const window =
    priorRanges.length > config.lookback
      ? priorRanges.slice(priorRanges.length - config.lookback)
      : priorRanges
  const rangePercentile = percentileNearestRank(window, config.forcePercentile)
  const forceQualified = rangePercentile != null && currentRange >= rangePercentile

  const previousBearish = previousClose < previousOpen
  const previousBullish = previousClose > previousOpen
  const currentBullish = srcClose > srcOpen
  const currentBearish = srcClose < srcOpen

  const bullishEngulfedSize =
    previousBodyHigh > previousBodyLow ? Math.max(0, srcClose - previousBodyLow) : 0
  const bullishEngulfPercent =
    previousBodySize > 0 ? Math.min(100, (bullishEngulfedSize / previousBodySize) * 100) : 0
  const bullishBodyEngulfing =
    previousBearish &&
    currentBullish &&
    srcClose > previousOpen &&
    bullishEngulfPercent >= config.engulfPercent

  const bearishEngulfedSize =
    previousBodyHigh > previousBodyLow ? Math.max(0, previousBodyHigh - srcClose) : 0
  const bearishEngulfPercent =
    previousBodySize > 0 ? Math.min(100, (bearishEngulfedSize / previousBodySize) * 100) : 0
  const bearishBodyEngulfing =
    previousBullish &&
    currentBearish &&
    srcClose < previousOpen &&
    bearishEngulfPercent >= config.engulfPercent

  const bullishSignal = bullishBodyEngulfing && forceQualified
  const bearishSignal = bearishBodyEngulfing && forceQualified
  const engulfPercentAchieved = bullishBodyEngulfing
    ? bullishEngulfPercent
    : bearishBodyEngulfing
      ? bearishEngulfPercent
      : 0

  return {
    bullishBodyEngulfing,
    bearishBodyEngulfing,
    forceQualified,
    bullishSignal,
    bearishSignal,
    engulfPercentAchieved,
    rangePercentile,
  }
}

/** Scan OHLC series (oldest → newest); emit bars with bullish/bearish signal. */
export function scanEngulfing(
  bars: readonly LightweightCandle[],
  config: EngulfingConfig = DEFAULT_ENGULFING_CONFIG,
): EngulfingEvent[] {
  const events: EngulfingEvent[] = []
  if (bars.length < 2) return events

  const ranges: number[] = []
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i]!
    const currentRange = bar.high - bar.low
    if (i === 0) {
      ranges.push(currentRange)
      continue
    }
    const prev = bars[i - 1]!
    const signals = calculateEngulfingSignals(
      bar.high,
      bar.low,
      bar.open,
      bar.close,
      prev.open,
      prev.close,
      ranges,
      config,
    )
    ranges.push(currentRange)

    if (signals.bullishSignal) {
      events.push({
        barIndex: i,
        time: bar.time,
        direction: EngulfingDirection.Bullish,
        srcOpen: bar.open,
        srcHigh: bar.high,
        srcLow: bar.low,
        srcClose: bar.close,
      })
    }
    if (signals.bearishSignal) {
      events.push({
        barIndex: i,
        time: bar.time,
        direction: EngulfingDirection.Bearish,
        srcOpen: bar.open,
        srcHigh: bar.high,
        srcLow: bar.low,
        srcClose: bar.close,
      })
    }
  }
  return events
}
