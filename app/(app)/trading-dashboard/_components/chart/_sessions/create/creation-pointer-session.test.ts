import assert from 'node:assert/strict'
import test from 'node:test'
import { CreationPointerSession } from './creation-pointer-session'

test('coarse gesture translates from the seeded anchor and ignores another pointer', () => {
  const session = new CreationPointerSession(({ x, y }) => ({ time: x, price: y }), 12)
  session.begin(1, 10, 20, { x: 100, y: 200 })
  assert.equal(session.move(2, 30, 40), null)
  assert.equal(session.move(1, 21, 20), null)
  assert.deepEqual(session.move(1, 25, 25), { time: 115, price: 205 })
  assert.deepEqual(session.finish(1, 25, 25), { tap: false, dragged: true })
  assert.equal(session.pointerId, null)
})

test('short press confirms as a tap; cancel discards an active gesture', () => {
  const session = new CreationPointerSession(() => null, 12)
  session.begin(1, 10, 20)
  assert.deepEqual(session.finish(1, 18, 20), { tap: true, dragged: false })
  session.begin(1, 10, 20)
  session.cancel()
  assert.equal(session.finish(1, 10, 20), null)
})
