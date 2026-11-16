import assert from 'node:assert/strict'
import test from 'node:test'
import { trendlineScreenSegment } from './trendline-geometry'

test('draft and committed share the same segment endpoints as the anchors', () => {
  const p1 = { x: 10, y: 20 }
  const p2 = { x: 80, y: 50 }
  const draft = trendlineScreenSegment(p1, p2)
  const committed = trendlineScreenSegment(p1, p2)
  assert.deepEqual(draft, committed)
  assert.equal(draft.x1, draft.mx1)
  assert.equal(draft.y1, draft.my1)
  assert.equal(draft.x2, draft.mx2)
  assert.equal(draft.y2, draft.my2)
  assert.deepEqual(
    { x1: draft.x1, y1: draft.y1, x2: draft.x2, y2: draft.y2 },
    { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
  )
})
