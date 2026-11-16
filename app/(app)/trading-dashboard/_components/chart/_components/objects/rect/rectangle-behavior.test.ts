import assert from 'node:assert/strict'
import test from 'node:test'
import { RectangleBehavior } from './rectangle-behavior'
import { TwoPointCreateBehavior } from '../../../_sessions/create/two-point-create-behavior'

const p1 = { time: 10, price: 1 }
const p2 = { time: 20, price: 2 }

test('rectangle creation delegates to shared two-point create behavior', () => {
  const behavior = new RectangleBehavior()
  const begun = behavior.beginCreation({ p1 })
  assert.ok(begun)
  assert.deepEqual(begun.state, { pointer: 'fine', p1, p2: null })
  const cleared = behavior.continueCreation(begun.state, {
    type: 'pointer-move',
    pointer: {
      pointerId: 1, pointerType: 'mouse', coarse: false, primary: true,
      screen: { x: 2, y: 3 }, chartPoint: null,
    },
  })
  assert.deepEqual(cleared.state, { pointer: 'fine', p1, p2: null })
  const moved = behavior.continueCreation(cleared.state, {
    type: 'pointer-move',
    pointer: {
      pointerId: 1, pointerType: 'mouse', coarse: false, primary: true,
      screen: { x: 2, y: 3 }, chartPoint: p2,
    },
  })
  assert.deepEqual(moved.state, { pointer: 'fine', p1, p2 })
  const committed = behavior.continueCreation(moved.state, { type: 'confirm' })
  assert.equal(committed.status, 'committed')
  assert.deepEqual(committed.effects?.[0]?.payload, { kind: 'rectangle', p1, p2 })
})

test('shared two-point create behavior supports coarse seed confirm', () => {
  const behavior = new TwoPointCreateBehavior('trendline', {
    secondPoint: (anchor) => ({ time: anchor.time + 1, price: anchor.price + 1 }),
  })
  const begun = behavior.beginCreation({ pointer: 'coarse', p1 })
  assert.equal(begun.state.pointer, 'coarse')
  const advanced = behavior.continueCreation(begun.state, { type: 'confirm' })
  assert.deepEqual(advanced.state, {
    pointer: 'coarse',
    phase: 'placing_p2',
    p1,
    p2: { time: 11, price: 2 },
  })
  const committed = behavior.continueCreation(advanced.state, { type: 'confirm' })
  assert.equal(committed.status, 'committed')
  assert.deepEqual(committed.effects?.[0]?.payload, {
    kind: 'trendline',
    p1,
    p2: { time: 11, price: 2 },
  })
})

test('rectangle anchor edit changes only the owned endpoint', () => {
  const behavior = new RectangleBehavior()
  const begun = behavior.beginEditing({ id: 'r1', endpoint: 'p1', p1, p2 })
  assert.ok(begun)
  const replacement = { time: 11, price: 1.5 }
  const moved = behavior.continueEditing(begun.state, {
    type: 'pointer-move',
    pointer: {
      pointerId: 4, pointerType: 'touch', coarse: true, primary: true,
      screen: { x: 4, y: 5 }, chartPoint: replacement,
    },
  })
  assert.deepEqual(moved.state, { mode: 'edit', id: 'r1', endpoint: 'p1', p1: replacement, p2 })
  assert.equal(behavior.continueEditing(moved.state, {
    type: 'pointer-up',
    pointer: {
      pointerId: 4, pointerType: 'touch', coarse: true, primary: true,
      screen: { x: 4, y: 5 }, chartPoint: replacement,
    },
  }).status, 'committed')
})
