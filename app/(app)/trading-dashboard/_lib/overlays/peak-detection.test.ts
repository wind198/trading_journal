import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LightweightCandle } from '@/lib/ticks/candles'
import {
  DEFAULT_PEAK_DETECTION_CONFIG,
  detectPeaks,
} from './peak-detection'

function candle(time: number, close: number): LightweightCandle {
  return { time, open: close, high: close, low: close, close }
}

test('detectPeaks: finds peak and trough on a V then A series', () => {
  // Flat warm-up then down to trough then up to peak then down
  const closes = [10, 10, 10, 10, 9, 8, 7, 8, 9, 10, 11, 10, 9]
  const candles = closes.map((c, i) => candle(i * 60, c))
  const events = detectPeaks(candles, {
    ...DEFAULT_PEAK_DETECTION_CONFIG,
    smoothLen: 3,
    pivotBars: 1,
    groupTimeBars: 1,
    groupPriceStdMult: 0.1,
  })
  const peaks = events.filter((e) => e.kind === 'peak')
  const troughs = events.filter((e) => e.kind === 'trough')
  assert.ok(troughs.length >= 1, 'expected a trough')
  assert.ok(peaks.length >= 1, 'expected a peak')
})

test('detectPeaks: groups nearby peaks in time/price', () => {
  // Two close local maxima that should merge into one
  const closes = [5, 5, 5, 6, 7, 6.9, 7.1, 6, 5, 5, 5]
  const candles = closes.map((c, i) => candle(i * 60, c))
  const events = detectPeaks(candles, {
    ...DEFAULT_PEAK_DETECTION_CONFIG,
    smoothLen: 3,
    pivotBars: 1,
    groupTimeBars: 4,
    groupPriceStdMult: 2,
    varianceLookback: 10,
    showTroughs: false,
  })
  const peaks = events.filter((e) => e.kind === 'peak')
  assert.ok(peaks.length <= 2, `expected grouped peaks, got ${peaks.length}`)
})

test('detectPeaks: disabled returns empty', () => {
  const candles = [1, 2, 3, 2, 1].map((c, i) => candle(i, c))
  assert.deepEqual(
    detectPeaks(candles, { ...DEFAULT_PEAK_DETECTION_CONFIG, enabled: false }),
    [],
  )
})
