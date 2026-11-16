import assert from 'node:assert/strict'
import test from 'node:test'
import { decideTwoPointTap } from './two-point-placement'

const first = { time: 120, price: 25 }
const second = { time: 60, price: 20 }

test('ignores an unmapped tap without changing an active draft', () => {
  assert.deepEqual(decideTwoPointTap(null, null), { kind: 'ignore' })
  assert.deepEqual(decideTwoPointTap(first, null), { kind: 'ignore' })
})

test('starts a draft on the first mapped tap', () => {
  assert.deepEqual(decideTwoPointTap(null, first), { kind: 'start', p1: first })
})

test('completes with original point order, including reverse direction', () => {
  assert.deepEqual(decideTwoPointTap(first, second), {
    kind: 'complete', p1: first, p2: second,
  })
})
