import assert from 'node:assert/strict'
import test from 'node:test'
import { DrawingSelectionSession } from './drawing-selection-session'
import type { ChartHandle } from '../../price-chart-handle'

test('selection uses nearest hit and preserves equal-distance order', () => {
  const selected: (string | null)[] = []
  const hit = (externalId: string, distance: number) => ({ externalId, distance })
  const empty = { hitTest: () => null }
  const handle = {
    trendlines: { hitTest: () => hit('line', 4) },
    rectangles: { hitTest: () => hit('rect', 4) },
    fibonacciRanges: empty, fibonacciExtensions: empty, warningCircles: empty,
    icons: { hitTest: () => hit('icon', 2) }, polylines: empty, textAnchors: empty,
  } as unknown as ChartHandle
  const behavior = new DrawingSelectionSession({
    handle, syncHitGeometry: () => {}, select: (id) => selected.push(id), editLabel: () => {},
  }, 350, 24)
  behavior.tap({ x: 5, y: 5 })
  assert.deepEqual(selected, ['icon'])
})

test('label double tap opens editor once and reset discards pending tap', () => {
  const selected: (string | null)[] = []
  const edited: string[] = []
  const empty = { hitTest: () => null }
  const handle = {
    trendlines: empty, rectangles: empty, fibonacciRanges: empty, fibonacciExtensions: empty,
    warningCircles: empty, icons: empty, polylines: { hitTest: () => ({ externalId: 'poly', distance: 1 }) }, textAnchors: empty,
  } as unknown as ChartHandle
  const behavior = new DrawingSelectionSession({
    handle, syncHitGeometry: () => {}, select: (id) => selected.push(id), editLabel: (id) => edited.push(id),
  }, 350, 24)
  behavior.tap({ x: 1, y: 1 }, 10, 10)
  behavior.reset()
  behavior.tap({ x: 1, y: 1 }, 10, 10)
  assert.deepEqual(edited, [])
  behavior.tap({ x: 1, y: 1 }, 10, 10)
  assert.deepEqual(edited, ['poly'])
  assert.deepEqual(selected, ['poly', 'poly', 'poly'])
})

test('pointer tap suppresses one chart click and cancellation drops the pending gesture', () => {
  const handle = { trendlines: { hitTest: () => null }, rectangles: { hitTest: () => null }, fibonacciRanges: { hitTest: () => null }, fibonacciExtensions: { hitTest: () => null }, warningCircles: { hitTest: () => null }, icons: { hitTest: () => null }, polylines: { hitTest: () => null }, textAnchors: { hitTest: () => null } } as unknown as ChartHandle
  const session = new DrawingSelectionSession({ handle, syncHitGeometry: () => {}, select: () => {}, editLabel: () => {} }, 350, 24)
  const event = (x: number) => ({ pointerId: 1, clientX: x, clientY: 10 }) as PointerEvent
  session.pointerDown(event(10))
  assert.equal(session.pointerUp(event(15)), true)
  assert.equal(session.shouldIgnoreChartClick(), true)
  assert.equal(session.shouldIgnoreChartClick(), false)
  session.pointerDown(event(10))
  session.cancelPointer()
  assert.equal(session.pointerUp(event(10)), false)
})
