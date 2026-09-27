import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LightweightCandle } from './candles'
import { mergeCandles } from './merge'

function bar(time: number, close: number): LightweightCandle {
  return { time, open: close, high: close, low: close, close }
}

test('mergeCandles overwrites the same time, appends, and sorts', () => {
  const merged = mergeCandles(
    [bar(300, 1), bar(100, 1), bar(200, 1)],
    [bar(200, 9), bar(200, 8), bar(400, 4)],
  )
  assert.deepEqual(
    merged.map((candle) => [candle.time, candle.close]),
    [
      [100, 1],
      [200, 8],
      [300, 1],
      [400, 4],
    ],
  )
})
