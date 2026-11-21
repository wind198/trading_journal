import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LightweightCandle } from '@/lib/ticks/candles'
import { rollingQuantile } from './candle-features'
import {
  detectBaselineDoji,
  detectBaselineForce,
  geometryScore,
} from './baseline-indicators'
import { detectBaselineEngulfing } from './engulfing'
import { validateEngulfingConfig } from './engulfing-config'
import { validateForceCandlesConfig, defaultForceCandlesConfig } from './force-candles-config'

function bar(
  index: number,
  open: number,
  close: number,
  wick = 0.00005,
): LightweightCandle {
  return {
    time: 1_700_000_000 + index * 300,
    open,
    high: Math.max(open, close) + wick,
    low: Math.min(open, close) - wick,
    close,
  }
}

function history(n: number, body = 0.001): LightweightCandle[] {
  const mid = 1.1
  return Array.from({ length: n }, (_, i) => {
    const o = mid - body / 2
    const c = mid + body / 2
    return bar(i, o, c)
  })
}

test('geometryScore boundaries match Python', () => {
  assert.equal(geometryScore(0.75, 0.75), 0)
  assert.equal(geometryScore(1, 0.75), 100)
  assert.ok(Math.abs(geometryScore(0.85, 0.75) - 40) < 1e-6)
  assert.equal(geometryScore(1.1, 0.6), 100)
})

test('configs validate', () => {
  validateForceCandlesConfig(defaultForceCandlesConfig())
  validateEngulfingConfig({
    enabled: true,
    baseline: { lookback: 10, percentile: 60 },
    geometry: { min_penetration: 0.75, open_tolerance_factor: 0, min_previous_body_factor: 0.5 },
    force: {
      min_body_ratio: 0.55,
      min_body_factor: 1,
      min_range_factor: 1,
      min_close_position: 0.7,
      min_force_score: 50,
    },
    scoring: { geometry_weight: 0.4, force_weight: 0.6, min_pattern_score: 60 },
  })
})

test('rollingQuantile excludes current bar', () => {
  const bodies = [1, 1, 1, 1, 50]
  assert.equal(rollingQuantile(bodies, 4, 4, 50), 1)
})

test('trend-aware doji matches Python v3 score and tier', () => {
  const bars = Array.from({ length: 150 }, (_, i) => ({
    time: 1_700_000_000 + i * 300,
    open: 1 + i * 0.002,
    high: 1 + i * 0.002 + 0.003,
    low: 1 + i * 0.002 - 0.001,
    close: 1 + i * 0.002 + 0.0015,
  }))
  bars.push({ time: 1_700_000_000 + 150 * 300, open: 1.301, high: 1.306, low: 1.296, close: 1.3012 })
  const events = detectBaselineDoji(bars)
  assert.equal(events.length, 1)
  assert.equal(events[0]?.time, bars[150]?.time)
  assert.equal(events[0]?.tier, 'High')
  assert.ok(Math.abs(events[0]!.score - 94.23865131578965) < 1e-8)
  assert.equal(events[0]?.direction, 1)
})

test('flat candle alone is insufficient for trend-aware doji; engulfing rejects it', () => {
  const bars = [...history(100)]
  bars.push(bar(100, 1.1, 1.1))
  const dojis = detectBaselineDoji(bars)
  assert.equal(dojis.length, 0)
  assert.equal(detectBaselineForce(bars).length, 0)

  const c1 = bar(101, 1.101, 1.1)
  const c2 = bar(102, 1.1, 1.1)
  const pair = [...history(100), c1, c2]
  assert.equal(detectBaselineEngulfing(pair).length, 0)
})

test('engulfing invalid open with zero tolerance', () => {
  const c1 = bar(0, 1.101, 1.1)
  const c2 = bar(1, 1.1005, 1.1015)
  c2.open = c1.close + 0.0005
  const rows = [...history(100), c1, c2]
  assert.equal(detectBaselineEngulfing(rows).length, 0)
})

test('bullish engulfing with relaxed scoring', () => {
  const c1 = bar(0, 1.101, 1.1, 0.0002)
  const pen = 0.75
  const body1 = c1.open - c1.close
  const c2Close = c1.close + pen * body1
  const c2 = bar(1, c1.close, c2Close, 0.00015)
  const rows = [...history(100), c1, c2]
  const events = detectBaselineEngulfing(rows, {
    enabled: true,
    baseline: { lookback: 100, percentile: 60 },
    geometry: {
      min_penetration: 0.6,
      open_tolerance_factor: 0,
      min_previous_body_factor: 0.5,
    },
    force: {
      min_body_ratio: 0.01,
      min_body_factor: 0.01,
      min_range_factor: 0.01,
      min_close_position: 0.01,
      min_force_score: 0,
    },
    scoring: { geometry_weight: 0.4, force_weight: 0.6, min_pattern_score: 0 },
  })
  assert.equal(events.length, 1)
  assert.equal(events[0]?.direction, 'BULLISH')
})
