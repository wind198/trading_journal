import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LightweightCandle } from '@/lib/ticks/candles'
import {
  backfillRegimeOnsets,
  calculateForceScores,
  closedCandlesAt,
  detectBaselineForce,
  detectKeyLevels,
  detectRegimeSegments,
  keyLevelDetectConfig,
  keyLevelVolumeBarCount,
} from './baseline-indicators'
import { keyLevelZoneStyle } from './key-level-style'

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

test('detectKeyLevels requires the full 288-candle tuning window', () => {
  const bars = Array.from({ length: 287 }, (_, i) => bar(i, 1.08, 1.0802))
  assert.deepEqual(detectKeyLevels(bars), [])
  assert.equal(keyLevelVolumeBarCount('3m'), 288)
})

test('closedCandlesAt drops only a still-forming final bucket', () => {
  const bars = [bar(0, 1.08, 1.0802), bar(1, 1.0802, 1.0804)]
  const finalOpen = bars[1]!.time
  assert.deepEqual(closedCandlesAt(bars, 300, finalOpen + 299), bars.slice(0, -1))
  assert.deepEqual(closedCandlesAt(bars, 300, finalOpen + 300), bars)
})

test('v4 detector returns no zones when ATR and window range are zero', () => {
  const bars = Array.from({ length: 288 }, (_, i) => bar(i, 1.1, 1.1, 0))
  assert.deepEqual(detectKeyLevels(bars), [])
})

test('key level config matches the exported EURUSD v4 tuning settings', () => {
  assert.deepEqual(keyLevelDetectConfig(), {
    atrPeriod: 10,
    atrMultiplier: 0.35,
    rangeMultiplier: 0.04,
    bin: 0.1,
    smoothing: 0.4,
    separation: 1.5,
    width: 0.5,
    maxZones: 7,
    reactionWeight: 0.55,
    pivot: 3,
    cluster: 1,
    lookahead: 12,
    minReversal: 0.6,
    retestGap: 6,
    boundarySlots: 2,
    lookbackBars: 288,
  })
})

test('v4 detector returns separated, sorted boundary and density zones', () => {
  const bars = Array.from({ length: 288 }, (_, i) => {
    const regime = i < 96 ? 1.1188 : i < 192 ? 1.121 : 1.1232
    const center = regime + 0.0007 * Math.sin((2 * Math.PI * i) / 24)
    const nextRegime = i + 1 < 96 ? 1.1188 : i + 1 < 192 ? 1.121 : 1.1232
    const next = nextRegime + 0.0007 * Math.sin((2 * Math.PI * (i + 1)) / 24)
    return bar(i, center, next, 0.00008)
  })

  const zones = detectKeyLevels(bars)
  assert.ok(zones.length > 0)
  assert.ok(zones.length <= 7)
  assert.ok(zones.some((zone) => zone.type === 'Boundary'))
  assert.ok(zones.some((zone) => zone.type === 'Density'))
  assert.ok(zones.filter((zone) => zone.type === 'Boundary').length <= 2)
  assert.deepEqual(zones.map((zone) => zone.center), [...zones].map((zone) => zone.center).sort((a, b) => a - b))
  for (let i = 1; i < zones.length; i++) {
    const previous = zones[i - 1]!
    const current = zones[i]!
    assert.ok(current.center > previous.center)
    assert.ok(previous.upper < current.lower)
  }
})

test('key level styles distinguish tuner channels', () => {
  assert.deepEqual(keyLevelZoneStyle('Boundary'), {
    fill: 'rgba(251, 191, 36, 0.20)',
    border: '#fbbf24',
  })
  assert.deepEqual(keyLevelZoneStyle('Density'), {
    fill: 'rgba(96, 165, 250, 0.18)',
    border: '#60a5fa',
  })
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
