import assert from 'node:assert/strict'
import test from 'node:test'
import { TwoPointEditBehavior } from './two-point-edit-behavior'

const p1 = { time: 10, price: 1 }
const p2 = { time: 20, price: 2 }

test('two-point edit moves only the owned endpoint and emits scoped effects', () => {
  const edit = new TwoPointEditBehavior('trendline')
  const begun = edit.beginEditing({ id: 't1', endpoint: 'p1', p1, p2 })
  const replacement = { time: 11, price: 1.5 }
  const moved = edit.continueEditing(begun.state, {
    type: 'pointer-move',
    pointer: {
      pointerId: 1, pointerType: 'mouse', coarse: false, primary: true,
      screen: { x: 1, y: 2 }, chartPoint: replacement,
    },
  })
  assert.deepEqual(moved.state, { mode: 'edit', id: 't1', endpoint: 'p1', p1: replacement, p2 })
  assert.deepEqual(moved.effects?.[0], {
    scopeId: 'trendline',
    type: 'change',
    payload: moved.state,
  })
  const done = edit.continueEditing(moved.state, {
    type: 'pointer-up',
    pointer: {
      pointerId: 1, pointerType: 'mouse', coarse: false, primary: true,
      screen: { x: 1, y: 2 }, chartPoint: replacement,
    },
  })
  assert.equal(done.status, 'committed')
  assert.deepEqual(done.effects?.[0], {
    scopeId: 'trendline',
    type: 'change-end',
    payload: { id: 't1' },
  })
})
