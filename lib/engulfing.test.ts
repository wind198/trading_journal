import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculateEngulfingSignals,
  DEFAULT_ENGULFING_CONFIG,
  EngulfingDirection,
  scanEngulfing,
} from './engulfing'
import type { LightweightCandle } from './ticks/candles'

test('bullish engulfing + force qualifies as bullishSignal', () => {
  // Prior ranges small → current wide range qualifies at 65th pct
  const priorRanges = Array.from({ length: 49 }, () => 1)
  const signals = calculateEngulfingSignals(
    12, // high
    0, // low → range 12
    2, // open
    11, // close bullish, closes above prev open 10
    10, // previousOpen
    3, // previousClose bearish body 3→10
    priorRanges,
    DEFAULT_ENGULFING_CONFIG,
  )
  // prev body size 7; engulfed = 11-3 = 8 → >70%
  assert.equal(signals.bullishBodyEngulfing, true)
  assert.equal(signals.forceQualified, true)
  assert.equal(signals.bullishSignal, true)
  assert.equal(signals.bearishSignal, false)
})

test('engulfing without force range fails signal', () => {
  const priorRanges = Array.from({ length: 49 }, () => 10)
  const signals = calculateEngulfingSignals(
    5,
    4, // tiny range
    4.1,
    4.9,
    4.8,
    4.2, // prev bearish
    priorRanges,
  )
  assert.equal(signals.forceQualified, false)
  assert.equal(signals.bullishSignal, false)
})

test('scanEngulfing emits bullish event on series', () => {
  const bars: LightweightCandle[] = []
  for (let i = 0; i < 50; i++) {
    bars.push({
      time: 1_700_000_000 + i * 180,
      open: 5,
      high: 5.5,
      low: 4.5,
      close: 5.2,
    })
  }
  // prev bearish
  bars.push({
    time: 1_700_000_000 + 50 * 180,
    open: 10,
    high: 10.2,
    low: 3,
    close: 3.5,
  })
  // current bullish engulf + wide range
  bars.push({
    time: 1_700_000_000 + 51 * 180,
    open: 3,
    high: 14,
    low: 2.5,
    close: 12,
  })
  const events = scanEngulfing(bars)
  assert.ok(events.some((e) => e.direction === EngulfingDirection.Bullish))
})
