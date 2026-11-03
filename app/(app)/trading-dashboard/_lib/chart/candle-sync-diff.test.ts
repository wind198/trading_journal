import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { LightweightCandle } from '@/lib/ticks/candles'
import { diffCandles } from './candle-sync-diff'

function bar(time: number, close: number, extras?: Partial<LightweightCandle>): LightweightCandle {
  return {
    time,
    open: extras?.open ?? close,
    high: extras?.high ?? close,
    low: extras?.low ?? close,
    close,
  }
}

test('unchanged: same reference or equal OHLC', () => {
  const a = [bar(1, 1), bar(2, 2)]
  assert.equal(diffCandles(a, a).kind, 'unchanged')
  assert.equal(diffCandles(a, [bar(1, 1), bar(2, 2)]).kind, 'unchanged')
  assert.equal(diffCandles([], []).kind, 'unchanged')
})

test('lastUpdated: only last OHLC changes', () => {
  const prev = [bar(1, 1), bar(2, 2)]
  const next = [bar(1, 1), bar(2, 3, { open: 2, high: 4, low: 1 })]
  assert.deepEqual(diffCandles(prev, next), { kind: 'lastUpdated' })
})

test('appended: prefix equal, new bars at end', () => {
  const prev = [bar(1, 1), bar(2, 2)]
  const next = [bar(1, 1), bar(2, 2), bar(3, 3)]
  assert.deepEqual(diffCandles(prev, next), { kind: 'appended', fromIndex: 2 })
})

test('prepended: older bars inserted at start', () => {
  const prev = [bar(2, 2), bar(3, 3)]
  const next = [bar(1, 1), bar(2, 2), bar(3, 3)]
  assert.deepEqual(diffCandles(prev, next), { kind: 'prepended', count: 1 })
})

test('replaced: middle edit, shrink, or last-change-plus-append', () => {
  assert.equal(diffCandles([bar(1, 1), bar(2, 2)], [bar(1, 9), bar(2, 2)]).kind, 'replaced')
  assert.equal(diffCandles([bar(1, 1), bar(2, 2)], [bar(1, 1)]).kind, 'replaced')
  assert.equal(
    diffCandles([bar(1, 1), bar(2, 2)], [bar(1, 1), bar(2, 9), bar(3, 3)]).kind,
    'replaced',
  )
  assert.equal(diffCandles([], [bar(1, 1)]).kind, 'replaced')
})
