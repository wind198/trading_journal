import assert from 'node:assert/strict'
import { test } from 'node:test'
import { CANDLE_TIMEFRAMES, ticksToCandles } from './candles'
import { TIMEFRAME_SECONDS } from '../market-analysis/snapshot'

test('M3 uses 180-second buckets consistently', () => {
  assert.equal(CANDLE_TIMEFRAMES['3m'], 180)
  assert.equal(TIMEFRAME_SECONDS.M3, 180)
  assert.equal(TIMEFRAME_SECONDS.M15, 900)
  const ticks = [0, 179, 180, 299, 359, 360].map((seconds, index) => ({
    time_msc: seconds * 1000, bid: 1, ask: 1, last: index + 1, volume: 0,
  }))
  assert.deepEqual(ticksToCandles(ticks, CANDLE_TIMEFRAMES['3m']), [
    { time: 0, open: 1, high: 2, low: 1, close: 2 },
    { time: 180, open: 3, high: 5, low: 3, close: 5 },
    { time: 360, open: 6, high: 6, low: 6, close: 6 },
  ])
})
