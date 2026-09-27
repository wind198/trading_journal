import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LightweightCandle } from './candles'
import {
  calculateBaseLineBias,
  DEFAULT_BASE_LINE_BIAS_CONFIG,
} from './base-line-bias'

function bar(
  time: number,
  high: number,
  low: number,
  close: number,
): LightweightCandle {
  return { time, open: close, high, low, close }
}

/** Flat range so base line stays at `mid` for every bar once lookback fills. */
function flatBars(count: number, mid: number, close: number): LightweightCandle[] {
  return Array.from({ length: count }, (_, i) =>
    bar(1_700_000_000 + i * 60, mid + 1, mid - 1, close),
  )
}

test('rejects invalid config', () => {
  assert.throws(() => calculateBaseLineBias([], { ...DEFAULT_BASE_LINE_BIAS_CONFIG, baseLineLength: 0 }))
  assert.throws(() =>
    calculateBaseLineBias([], { ...DEFAULT_BASE_LINE_BIAS_CONFIG, thresholdPercent: 49 }),
  )
})

test('42/52 bullish meets threshold; 41/52 stays neutral', () => {
  const mid = 100
  // Need baseLineLength + analysisLength - 1 = 103 bars for first complete point
  const warm = flatBars(51, mid, mid) // warmup with equal closes (ignored)
  const analysisBull42 = [
    ...Array.from({ length: 42 }, (_, i) => bar(1_700_000_000 + (51 + i) * 60, mid + 1, mid - 1, mid + 1)),
    ...Array.from({ length: 10 }, (_, i) => bar(1_700_000_000 + (93 + i) * 60, mid + 1, mid - 1, mid - 1)),
  ]
  const at42 = calculateBaseLineBias([...warm, ...analysisBull42])
  const last42 = at42[at42.length - 1]
  assert.equal(last42.bullishCount, 42)
  assert.equal(last42.bearishCount, 10)
  assert.ok(last42.bullishPercent >= 80)
  assert.equal(last42.value, 1)

  const analysisBull41 = [
    ...Array.from({ length: 41 }, (_, i) => bar(1_700_000_000 + (51 + i) * 60, mid + 1, mid - 1, mid + 1)),
    ...Array.from({ length: 11 }, (_, i) => bar(1_700_000_000 + (92 + i) * 60, mid + 1, mid - 1, mid - 1)),
  ]
  const at41 = calculateBaseLineBias([...warm, ...analysisBull41])
  const last41 = at41[at41.length - 1]
  assert.equal(last41.bullishCount, 41)
  assert.ok(last41.bullishPercent < 80)
  assert.equal(last41.value, 0)
})

test('42/52 bearish meets threshold', () => {
  const mid = 100
  const warm = flatBars(51, mid, mid)
  const analysis = [
    ...Array.from({ length: 42 }, (_, i) => bar(1_700_000_000 + (51 + i) * 60, mid + 1, mid - 1, mid - 1)),
    ...Array.from({ length: 10 }, (_, i) => bar(1_700_000_000 + (93 + i) * 60, mid + 1, mid - 1, mid + 1)),
  ]
  const points = calculateBaseLineBias([...warm, ...analysis])
  const last = points[points.length - 1]
  assert.equal(last.bearishCount, 42)
  assert.equal(last.value, -1)
})

test('equal close excluded from both counts', () => {
  const mid = 100
  const config = { baseLineLength: 3, analysisLength: 5, thresholdPercent: 80 }
  // highs/lows fixed → base always mid after 3 bars
  const bars: LightweightCandle[] = [
    bar(1, mid + 1, mid - 1, mid),
    bar(2, mid + 1, mid - 1, mid),
    bar(3, mid + 1, mid - 1, mid + 1), // bull
    bar(4, mid + 1, mid - 1, mid - 1), // bear
    bar(5, mid + 1, mid - 1, mid), // equal
    bar(6, mid + 1, mid - 1, mid + 1), // bull
    bar(7, mid + 1, mid - 1, mid + 1), // bull
  ]
  const points = calculateBaseLineBias(bars, config)
  const last = points[points.length - 1]
  // window bars 3..7: bull, bear, equal, bull, bull → 3 bull, 1 bear, 1 equal
  assert.equal(last.bullishCount, 3)
  assert.equal(last.bearishCount, 1)
  assert.equal(last.bullishCount + last.bearishCount, 4)
  assert.equal(last.value, 0)
})
