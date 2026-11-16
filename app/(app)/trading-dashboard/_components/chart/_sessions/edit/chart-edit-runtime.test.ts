import assert from 'node:assert/strict'
import test from 'node:test'
import type { ChartHandle } from '../../price-chart-handle'
import { createChartEditRuntime } from './chart-edit-runtime'

const empty = { hitTest: () => null, hitTestAnchor: () => null, getDrawing: () => null }

function pairHandle(opts: {
  rectHit?: { id: string; endpoint: 'p1' | 'p2' } | null
  trendHit?: { id: string; endpoint: 'p1' | 'p2' } | null
  rectDrawing?: { id: string; p1: { time: number; price: number }; p2: { time: number; price: number } } | null
  trendDrawing?: { id: string; p1: { time: number; price: number }; p2: { time: number; price: number } } | null
}) {
  return {
    chart: {
      timeScale: () => ({
        coordinateToLogical: () => null,
        coordinateToTime: (x: number) => x,
        timeToCoordinate: (t: number) => t,
      }),
    },
    price: {
      coordinateToPrice: (y: number) => y,
      priceToCoordinate: (p: number) => p,
    },
    trendlines: {
      ...empty,
      hitTestAnchor: () => opts.trendHit ?? null,
      getDrawing: () => opts.trendDrawing ?? null,
    },
    rectangles: {
      ...empty,
      hitTestAnchor: () => opts.rectHit ?? null,
      getDrawing: () => opts.rectDrawing ?? null,
    },
    fibonacciRanges: empty,
    warningCircles: empty,
    icons: empty,
    textAnchors: empty,
    polylines: empty,
    fibonacciExtensions: { ...empty, hitTestExtensionAnchor: () => null },
  } as unknown as ChartHandle
}

function runtimeFor(handle: ChartHandle, selectedId: string) {
  const changed: unknown[] = []
  const ended: string[] = []
  const captured: number[] = []
  const runtime = createChartEditRuntime({
    handle,
    candles: () => [{ time: 1 }, { time: 61 }],
    selectedId: () => selectedId,
    select: () => {},
    syncHitGeometry: () => {},
    capture: (event) => { captured.push(event.pointerId) },
    release: () => {},
    releaseById: () => {},
    syncLock: () => {},
    markDrag: () => {},
    change: (id, p1, p2) => changed.push({ id, p1, p2 }),
    changeEnd: (id) => ended.push(id),
    polylineChange: () => {},
    polylineChangeEnd: () => {},
    drawings: () => ({
      trendlines: [],
      rectangles: [],
      fibonacciRanges: [],
      warningCircles: [],
      icons: [],
      textAnchors: [],
    }),
  }, 12)
  const event = {
    pointerId: 1,
    clientX: 5,
    clientY: 5,
    pointerType: 'mouse',
    preventDefault() {},
  } as PointerEvent
  return { runtime, event, changed, ended, captured }
}

test('rectangle anchor edit routes through store and emits change/change-end', () => {
  const drawing = { id: 'rect', p1: { time: 10, price: 100 }, p2: { time: 20, price: 110 } }
  const h = runtimeFor(pairHandle({
    rectHit: { id: 'rect', endpoint: 'p1' },
    rectDrawing: drawing,
  }), 'rect')
  h.runtime.pointerDown(h.event, { x: 5, y: 5 })
  assert.equal(h.runtime.store.snapshot.status, 'active')
  assert.equal(h.runtime.store.snapshot.workflow, 'edit')
  assert.equal(h.runtime.store.snapshot.scopeId, 'rectangle')
  assert.deepEqual(h.captured, [1])
  h.runtime.pointerMove(h.event, { x: 15, y: 20 })
  assert.deepEqual(h.changed, [{ id: 'rect', p1: { time: 15, price: 20 }, p2: drawing.p2 }])
  assert.equal(h.runtime.pointerUp(h.event), true)
  assert.deepEqual(h.ended, ['rect'])
  assert.equal(h.runtime.store.snapshot.status, 'idle')
  assert.equal(h.runtime.isDragging, false)
})

test('trendline anchor edit routes through store and emits change/change-end', () => {
  const drawing = { id: 'tl', p1: { time: 1, price: 2 }, p2: { time: 3, price: 4 } }
  const h = runtimeFor(pairHandle({
    trendHit: { id: 'tl', endpoint: 'p2' },
    trendDrawing: drawing,
  }), 'tl')
  h.runtime.pointerDown(h.event, { x: 5, y: 5 })
  assert.equal(h.runtime.store.snapshot.status, 'active')
  assert.equal(h.runtime.store.snapshot.scopeId, 'trendline')
  h.runtime.pointerMove(h.event, { x: 30, y: 40 })
  assert.deepEqual(h.changed, [{ id: 'tl', p1: drawing.p1, p2: { time: 30, price: 40 } }])
  assert.equal(h.runtime.pointerUp(h.event), true)
  assert.deepEqual(h.ended, ['tl'])
})

test('trendline store phase wins over rectangle when both anchors hit', () => {
  const trend = { id: 'tl', p1: { time: 1, price: 2 }, p2: { time: 3, price: 4 } }
  const rect = { id: 'tl', p1: { time: 10, price: 100 }, p2: { time: 20, price: 110 } }
  const h = runtimeFor(pairHandle({
    trendHit: { id: 'tl', endpoint: 'p2' },
    trendDrawing: trend,
    rectHit: { id: 'tl', endpoint: 'p1' },
    rectDrawing: rect,
  }), 'tl')
  h.runtime.pointerDown(h.event, { x: 5, y: 5 })
  assert.equal(h.runtime.store.snapshot.status, 'active')
  assert.equal(h.runtime.store.snapshot.scopeId, 'trendline')
  h.runtime.pointerMove(h.event, { x: 30, y: 40 })
  assert.deepEqual(h.changed, [{ id: 'tl', p1: trend.p1, p2: { time: 30, price: 40 } }])
  assert.equal(h.runtime.pointerUp(h.event), true)
  assert.deepEqual(h.ended, ['tl'])
})

test('foreign rectangle anchor blocks later legacy phases', () => {
  const h = runtimeFor(pairHandle({
    rectHit: { id: 'other', endpoint: 'p1' },
    rectDrawing: { id: 'other', p1: { time: 1, price: 1 }, p2: { time: 2, price: 2 } },
  }), 'selected')
  h.runtime.pointerDown(h.event, { x: 5, y: 5 })
  assert.equal(h.runtime.isDragging, false)
  assert.equal(h.runtime.store.snapshot.status, 'idle')
  assert.deepEqual(h.captured, [])
})

test('touch trendline edit drags relative to the anchor, not the finger hit offset', () => {
  const drawing = { id: 'tl', p1: { time: 1, price: 2 }, p2: { time: 10, price: 20 } }
  const h = runtimeFor(pairHandle({
    trendHit: { id: 'tl', endpoint: 'p2' },
    trendDrawing: drawing,
  }), 'tl')
  const down = {
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    pointerType: 'touch',
    preventDefault() {},
  } as PointerEvent
  // Finger lands off-center on the fat hit target; absolute mapping would jump to here.
  h.runtime.pointerDown(down, { x: 18, y: 28 })
  assert.equal(h.runtime.store.snapshot.status, 'active')
  const move = {
    pointerId: 1,
    clientX: 115,
    clientY: 130,
    pointerType: 'touch',
    preventDefault() {},
  } as PointerEvent
  // Local point is deliberately wrong; relative drag must ignore it and apply client delta to p2.
  h.runtime.pointerMove(move, { x: 999, y: 999 })
  assert.deepEqual(h.changed, [{ id: 'tl', p1: drawing.p1, p2: { time: 25, price: 50 } }])
  assert.equal(h.runtime.pointerUp(move), true)
  assert.deepEqual(h.ended, ['tl'])
})
