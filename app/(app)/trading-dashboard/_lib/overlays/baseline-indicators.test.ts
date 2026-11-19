import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LightweightCandle } from '@/lib/ticks/candles'
import {
  backfillRegimeOnsets,
  calculateForceScores,
  detectBaselineForce,
  detectKeyLevels,
  detectRegimeSegments,
  keyLevelDetectConfig,
  keyLevelVolumeBarCount,
  type VolumeCandle,
} from './baseline-indicators'

function bar(index: number, open: number, close: number, wick = 0.00005): LightweightCandle {
  return {
    time: 1_700_000_000 + index * 300,
    open,
    high: Math.max(open, close) + wick,
    low: Math.min(open, close) - wick,
    close,
  }
}

test('force detector uses prior bars for its percentile baseline', () => {
  const bars = Array.from({ length: 100 }, (_, i) => bar(i, 1 + i * 0.00001, 1.0001 + i * 0.00001))
  bars.push(bar(100, 1.001, 1.003, 0.00005))
  const events = detectBaselineForce(bars)
  const scores = calculateForceScores(bars)
  assert.equal(events.length, 1)
  assert.equal(scores.length, 1)
  assert.ok(scores[0]!.score >= 0 && scores[0]!.score <= 100)
  assert.equal(events[0]?.direction, 'BULLISH')
  assert.equal(events[0]?.time, bars[100]?.time)
})

test('regime detector returns causal up segments after warmup', () => {
  const bars = Array.from({ length: 180 }, (_, i) => bar(i, 1 + i * 0.0001, 1.00008 + i * 0.0001))
  const segments = detectRegimeSegments(bars)
  assert.equal(segments.length, 1)
  assert.equal(segments[0]?.regime, 'UP')
  assert.equal(segments[0]?.startTime, bars[151]?.time)
  assert.equal(segments[0]?.endTime, bars[179]?.time)
})

test('detectKeyLevels returns empty when fewer than 120 bars are supplied', () => {
  const bars: VolumeCandle[] = Array.from({ length: 100 }, (_, i) => ({
    ...bar(i, 1.08, 1.0802),
    volume: 10,
  }))
  assert.equal(detectKeyLevels(bars, 180).length, 0)
  assert.equal(keyLevelVolumeBarCount('3m'), 500)
})

test('3m config allows more levels with min adjusted score disabled', () => {
  const cfg = keyLevelDetectConfig(180)
  assert.equal(cfg.maxLevels, 10)
  assert.equal(cfg.minAdjustedScore, 0)
  assert.equal(cfg.minIndependentTouches, 2)
})

test('regime display backfills a directional onset by no more than one Kijun period', () => {
  const positions = Array.from({ length: 230 }, () => 1 as number | null)
  const regimes = Array.from({ length: 230 }, (_, i) => i < 151 ? null : i < 220 ? 'CHOPPY' as const : 'UP' as const)
  const display = backfillRegimeOnsets(positions, regimes)
  // Confirmation is at 220, so the 52-bar inclusive window begins at 169.
  assert.equal(display[168], 'CHOPPY')
  assert.equal(display[169], 'UP')
  assert.equal(display[219], 'UP')
  assert.equal(display[220], 'UP')
})
