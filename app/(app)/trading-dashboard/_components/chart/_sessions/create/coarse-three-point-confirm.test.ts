import assert from 'node:assert/strict'
import test from 'node:test'
import { decideCoarseThreePointConfirm } from './coarse-three-point-confirm'

const p1 = { time: 10, price: 1 }
const p2 = { time: 20, price: 2 }
const p3 = { time: 30, price: 1.5 }

test('pure confirmation decision covers all phases', () => {
  assert.deepEqual(decideCoarseThreePointConfirm({ phase: 'idle' }, p2), { kind: 'ignore' })
  assert.deepEqual(decideCoarseThreePointConfirm({ phase: 'placing_p1', p1 }, p2), { kind: 'place_second', p1, p2 })
  assert.deepEqual(decideCoarseThreePointConfirm({ phase: 'placing_p2', p1, p2 }, p3), { kind: 'place_third', p1, p2, p3 })
  assert.deepEqual(decideCoarseThreePointConfirm({ phase: 'placing_p3', p1, p2, p3 }, null), { kind: 'complete', p1, p2, p3 })
})
