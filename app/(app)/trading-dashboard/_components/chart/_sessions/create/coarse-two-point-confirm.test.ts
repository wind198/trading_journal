import assert from 'node:assert/strict'
import test from 'node:test'
import { decideCoarseTwoPointConfirm } from './coarse-two-point-confirm'

const p1 = { time: 10, price: 1 }
const p2 = { time: 20, price: 2 }

test('pure confirm decision covers idle, first, and second phase', () => {
  assert.deepEqual(decideCoarseTwoPointConfirm({ phase: 'idle' }, p2), { kind: 'ignore' })
  assert.deepEqual(decideCoarseTwoPointConfirm({ phase: 'placing_p1', p1 }, p2), { kind: 'place_second', p1, p2 })
  assert.deepEqual(decideCoarseTwoPointConfirm({ phase: 'placing_p2', p1, p2 }, null), { kind: 'complete', p1, p2 })
  assert.deepEqual(decideCoarseTwoPointConfirm({ phase: 'placing_p1', p1 }, null), { kind: 'ignore' })
})
