import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calculateForceSignals,
  calculateMetrics,
  percentileNearestRank,
} from './force-candles'
import {
  advanceForceStatus,
  calculateBodyCorrection,
  calculateForceDecay,
  filterConsecutiveForceDisplay,
  ForceDirection,
  ForceStatus,
  type ForceEvent,
} from './force-candle-decay'
import type { LightweightCandle } from './ticks/candles'

test('calculateMetrics close at high / low', () => {
  const high = calculateMetrics(10, 0, 2, 10)
  assert.equal(high.closePosition, 100)
  assert.equal(high.bodyPercent, 80)
  const low = calculateMetrics(10, 0, 8, 0)
  assert.equal(low.closePosition, 0)
})

test('percentileNearestRank 70 of 1..10', () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  // ceil(0.7 * 10) = 7 → sorted[6] = 7
  assert.equal(percentileNearestRank(values, 70), 7)
})

test('bullish impulse force when range ok', () => {
  // Wide bullish body closing near high
  const ranges = Array.from({ length: 49 }, () => 1)
  const { bullishForce, bearishForce } = calculateForceSignals(10, 0, 1, 9.5, ranges, {
    lookback: 100,
    minRangePercentile: 70,
    minClosePos: 0.7,
    maxClosePos: 0.3,
    minBodyPct: 0.5,
    minRejectionWickPct: 0.25,
  })
  assert.equal(bullishForce, true)
  assert.equal(bearishForce, false)
})

test('advanceForceStatus steps fully → partially → barely', () => {
  assert.equal(
    advanceForceStatus(ForceStatus.FullyActive, 0.4, 0.4),
    ForceStatus.PartiallyActive,
  )
  assert.equal(
    advanceForceStatus(ForceStatus.PartiallyActive, 0.4, 0.4),
    ForceStatus.BarelyActive,
  )
})

test('calculateBodyCorrection bullish', () => {
  // force body 0→10, close at 5 → 50% penetration from top
  assert.equal(calculateBodyCorrection(5, 0, 10, true), 0.5)
})

test('calculateForceDecay emits bullish event on wide impulse', () => {
  const bars: LightweightCandle[] = []
  // warm-up small ranges
  for (let i = 0; i < 49; i++) {
    bars.push({
      time: 1_700_000_000 + i * 180,
      open: 1,
      high: 1.2,
      low: 0.9,
      close: 1.1,
    })
  }
  // force bullish bar
  bars.push({
    time: 1_700_000_000 + 49 * 180,
    open: 1,
    high: 3,
    low: 0.95,
    close: 2.9,
  })
  const result = calculateForceDecay(bars)
  assert.ok(result.activeEvents.some((e) => e.direction === ForceDirection.Bullish))
})

test('filterConsecutiveForceDisplay keeps first in streak only', () => {
  const stub = (barIndex: number, eventId: number): ForceEvent => ({
    eventId,
    barIndex,
    time: barIndex,
    direction: ForceDirection.Bullish,
    srcOpen: 1,
    srcHigh: 2,
    srcLow: 1,
    srcClose: 2,
    bodySize: 1,
    bodyCorrection: 0,
    status: ForceStatus.FullyActive,
    strength: 100,
  })
  const shown = filterConsecutiveForceDisplay([
    stub(5, 3),
    stub(1, 1),
    stub(2, 2),
    stub(2, 4),
    stub(4, 5),
  ])
  assert.deepEqual(
    shown.map((e) => e.eventId),
    [1, 5],
  )
})
