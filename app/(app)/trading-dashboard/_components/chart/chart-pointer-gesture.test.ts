import assert from 'node:assert/strict'
import test from 'node:test'
import { isCoarsePointerEvent, shapePreviewFollowsPointer } from './chart-pointer-gesture'

function pointer(pointerType: string): PointerEvent {
  return { pointerType } as PointerEvent
}

test('coarse classification prefers touch or coarse media', () => {
  assert.equal(isCoarsePointerEvent(pointer('touch'), false), true)
  assert.equal(isCoarsePointerEvent(pointer('mouse'), true), true)
  assert.equal(isCoarsePointerEvent(pointer('mouse'), false), false)
})

test('shape preview follows fine pointers only', () => {
  assert.equal(shapePreviewFollowsPointer(false, pointer('mouse')), true)
  assert.equal(shapePreviewFollowsPointer(false, pointer('touch')), false)
  assert.equal(shapePreviewFollowsPointer(true), false)
  assert.equal(shapePreviewFollowsPointer(false), true)
})
