import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LightweightCandle } from './candles'
import { ichimoku } from './ichimoku'

function bars(count: number, interval = 60): LightweightCandle[] {
  return Array.from({ length: count }, (_, i) => ({
    time: 1_700_000_000 + i * interval,
    open: i,
    high: 10 + i,
    low: i,
    close: 5 + i,
  }))
}

test('conversion and base start after doubled lookbacks', () => {
  assert.equal(ichimoku(bars(17), 60).conversion.length, 0)

  const atConversion = ichimoku(bars(18), 60)
  assert.equal(atConversion.conversion.length, 1)
  assert.equal(atConversion.conversion[0].time, 1_700_000_000 + 17 * 60)
  assert.equal(atConversion.base.length, 0)
  assert.equal(atConversion.cloud.length, 0)

  const atBase = ichimoku(bars(52), 60)
  assert.equal(atBase.base.length, 1)
  assert.equal(atBase.cloud.length, 0)
})

test('cloud is displaced 52 bars and is not a line series', () => {
  const interval = 60
  const data = bars(104, interval)
  const result = ichimoku(data, interval)

  assert.equal(result.cloud.length, 1)
  assert.equal(result.cloud[0].time, data[103].time + 52 * interval)
  assert.ok(result.cloud[0].a > result.cloud[0].b)
  assert.equal('spanA' in result, false)
  assert.equal('spanB' in result, false)
})
