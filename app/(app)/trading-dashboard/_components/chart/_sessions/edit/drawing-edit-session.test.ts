import assert from 'node:assert/strict'
import test from 'node:test'
import { DrawingEditSession } from './drawing-edit-session'
import { createToolEditBehaviors } from './edit-tool-registry'
import type { ChartHandle } from '../../price-chart-handle'

function harness(kind: 'circle' | 'polyline' | 'extension') {
  const empty = { hitTest: () => null, hitTestAnchor: () => null, getDrawing: () => null }
  const selectedId = kind
  const handle = {
    chart: { timeScale: () => ({ coordinateToLogical: () => null, coordinateToTime: (x: number) => x, timeToCoordinate: (x: number) => x }) },
    price: { coordinateToPrice: (y: number) => y, priceToCoordinate: (y: number) => y },
    trendlines: empty, rectangles: empty, fibonacciRanges: empty, icons: empty, textAnchors: empty,
    warningCircles: kind === 'circle' ? {
      ...empty,
      hitTestAnchor: () => ({ id: 'circle', endpoint: 'p1' }),
      getDrawing: () => ({ id: 'circle', p1: { time: 10, price: 100 }, p2: { time: 20, price: 110 } }),
    } : empty,
    polylines: kind === 'polyline' ? {
      ...empty,
      hitTestAnchor: () => ({ id: 'polyline', vertexIndex: 1 }),
      getDrawing: () => ({ id: 'polyline', points: [{ time: 10, price: 1 }, { time: 20, price: 2 }] }),
    } : empty,
    fibonacciExtensions: kind === 'extension' ? {
      ...empty,
      hitTestExtensionAnchor: () => null,
      hitTest: () => ({ externalId: 'extension' }),
      getDrawing: () => ({ p1: { time: 10, price: 1 }, p2: { time: 20, price: 2 }, p3: { time: 30, price: 3 } }),
    } : { ...empty, hitTestExtensionAnchor: () => null },
  } as unknown as ChartHandle
  const changed: unknown[] = []
  const ended: string[] = []
  const released: number[] = []
  let dragged = false
  const behavior = new DrawingEditSession({
    handle, candles: () => [{ time: 1 }, { time: 61 }], selectedId: () => selectedId,
    select: () => {},
    syncHitGeometry: () => {}, capture: () => {}, release: () => {}, releaseById: (id) => { released.push(id) }, syncLock: () => {},
    markDrag: () => { dragged = true },
    change: (_id, p1, p2) => changed.push({ p1, p2 }),
    changeEnd: (id) => ended.push(id),
    polylineChange: (_id, points) => changed.push(points),
    polylineChangeEnd: (id) => ended.push(id),
  }, 12, createToolEditBehaviors(handle, () => ({ trendlines: [], rectangles: [], fibonacciRanges: [], icons: [], textAnchors: [], warningCircles: [] })))
  const event = { pointerId: 1, clientX: 5, clientY: 5, preventDefault() {} } as PointerEvent
  return { behavior, event, changed, ended, released, wasDragged: () => dragged }
}

test('moving a warning circle center preserves its rim offset', () => {
  const h = harness('circle')
  h.behavior.pointerDown(h.event, { x: 5, y: 5 })
  h.behavior.pointerMove(h.event, { x: 15, y: 20 })
  assert.deepEqual(h.changed, [{ p1: { time: 15, price: 20 }, p2: { time: 25, price: 30 } }])
  assert.equal(h.wasDragged(), true)
  assert.equal(h.behavior.pointerUp(h.event), true)
  assert.deepEqual(h.ended, ['circle'])
})

test('polyline vertex drag changes one point and ends once', () => {
  const h = harness('polyline')
  h.behavior.pointerDown(h.event, { x: 5, y: 5 })
  h.behavior.pointerMove(h.event, { x: 30, y: 3 })
  assert.deepEqual(h.changed, [[{ time: 10, price: 1 }, { time: 30, price: 3 }]])
  assert.equal(h.behavior.pointerUp(h.event), true)
  assert.equal(h.behavior.pointerUp(h.event), false)
  assert.deepEqual(h.ended, ['polyline'])
})

test('whole extension drag moves all vertices by the same delta', () => {
  const h = harness('extension')
  h.behavior.pointerDown(h.event, { x: 5, y: 5 })
  h.behavior.pointerMove(h.event, { x: 7, y: 8 })
  assert.deepEqual(h.changed, [[{ time: 12, price: 4 }, { time: 22, price: 5 }, { time: 32, price: 6 }]])
  h.behavior.pointerCancel(h.event)
  assert.deepEqual(h.ended, ['extension'])
  assert.equal(h.behavior.isDragging, false)
})

test('tool switch releases an active edit once', () => {
  const h = harness('circle')
  h.behavior.pointerDown(h.event, { x: 5, y: 5 })
  h.behavior.cancelActive()
  h.behavior.dispose()
  assert.deepEqual(h.released, [1])
  assert.deepEqual(h.ended, ['circle'])
})

test('text press selects immediately but edits only after the movement threshold', () => {
  const drawing = { id: 'text', p1: { time: 10, price: 20 } }
  const empty = { hitTest: () => null, hitTestAnchor: () => null, getDrawing: () => null }
  const textPrimitive = {
    hitTest: () => ({ externalId: 'text' }),
    hitTestAnchor: () => ({ id: 'text', endpoint: 'p1' }),
    getDrawing: (id: string) => id === 'text' ? drawing : null,
  }
  const handle = {
    chart: { timeScale: () => ({ coordinateToLogical: () => null, coordinateToTime: (x: number) => x }) },
    price: { coordinateToPrice: (y: number) => y },
    trendlines: empty, rectangles: empty, fibonacciRanges: empty, warningCircles: empty,
    fibonacciExtensions: empty, polylines: empty, icons: empty, textAnchors: textPrimitive,
  } as unknown as ChartHandle
  const selected: string[] = []
  const changed: unknown[] = []
  const ended: string[] = []
  const tools = createToolEditBehaviors(handle, () => ({ trendlines: [], rectangles: [], fibonacciRanges: [], warningCircles: [], icons: [], textAnchors: [drawing as never] }))
  const behavior = new DrawingEditSession({
    handle, candles: () => [{ time: 1 }, { time: 61 }], selectedId: () => 'text',
    select: (id) => selected.push(id), syncHitGeometry: () => {}, capture: () => {}, release: () => {}, releaseById: () => {},
    syncLock: () => {}, markDrag: () => {}, change: (id, p1, p2) => changed.push({ id, p1, p2 }),
    changeEnd: (id) => ended.push(id), polylineChange: () => {}, polylineChangeEnd: () => {},
  }, 12, tools)
  const event = (x: number) => ({ pointerId: 1, clientX: x, clientY: 5, preventDefault() {} }) as PointerEvent
  behavior.pointerDown(event(5), { x: 5, y: 5 })
  behavior.pointerMove(event(15), { x: 15, y: 5 })
  assert.deepEqual(selected, ['text'])
  assert.deepEqual(changed, [])
  behavior.pointerMove(event(19), { x: 19, y: 5 })
  assert.deepEqual(changed, [{ id: 'text', p1: { time: 24, price: 20 }, p2: { time: 24, price: 20 } }])
  behavior.cancelActive()
  behavior.pointerUp(event(19))
  assert.deepEqual(ended, ['text'])
})
