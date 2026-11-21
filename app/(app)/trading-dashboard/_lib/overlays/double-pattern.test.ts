import assert from 'node:assert/strict'
import { test } from 'node:test'
import { detectDoublePatterns } from './double-pattern'

test('double pattern port matches Python v1 on a repeating price series', () => {
  const bars = Array.from({ length: 120 }, (_, i) => {
    const value = 1.1 + 0.01 * Math.sin(2 * Math.PI * i / 20)
    return { time: 1_700_000_000 + i * 300, open: value, high: value + 0.001,
      low: value - 0.001, close: value }
  })
  const patterns = detectDoublePatterns(bars)
  assert.equal(patterns.length, 9)
  assert.deepEqual(patterns.slice(0, 2).map(({ type, a, m, b, formed, decision, state, score }) =>
    ({ type, a, m, b, formed, decision, state, score })), [
    { type: 'TOP', a: 5, m: 15, b: 25, formed: 30, decision: 66, state: 'EXPIRED', score: 85 },
    { type: 'BOTTOM', a: 15, m: 25, b: 35, formed: 40, decision: 76, state: 'EXPIRED', score: 85 },
  ])
  assert.ok(Math.abs(patterns[0]!.atr - 0.0029959775705167917) < 1e-12)
})

test('double top confirms on neckline break at the Python decision bar', () => {
  const bars = Array.from({ length: 120 }, (_, i) => {
    const value = i === 31 ? 1.088 : 1.1 + 0.01 * Math.sin(2 * Math.PI * i / 20)
    return { time: 1_700_000_000 + i * 300, open: value, high: value + 0.001,
      low: value - 0.001, close: value }
  })
  const first = detectDoublePatterns(bars)[0]!
  assert.deepEqual([first.type, first.a, first.m, first.b, first.state, first.decision, first.score],
    ['TOP', 5, 15, 25, 'CONFIRMED', 31, 85])
  assert.equal(first.decisionTime, bars[31]!.time)
})
