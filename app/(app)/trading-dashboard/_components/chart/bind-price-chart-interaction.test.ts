import assert from 'node:assert/strict'
import test from 'node:test'
import { bindPriceChartInteraction, seedTouchShapeDraft, isTouchSeedShapeTool, type PriceChartInteractionRefs } from './bind-price-chart-interaction'
import type { ChartHandle } from './price-chart-handle'
import type { ChartDrawingKind, DrawingPoint } from '../../_lib/chart/chart-drawings'
import { FibonacciRangeExtensionPrimitive } from './primitives/fibonacci-range-extension-primitive'

function harness(tool: ChartDrawingKind) {
  const listeners = new Map<string, (event: PointerEvent) => void>()
  let hover: (event: { point: { x: number; y: number } }) => void = () => {}
  const el = {
    clientWidth: 800, clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    addEventListener: (name: string, fn: (event: PointerEvent) => void) => listeners.set(name, fn),
    removeEventListener() {}, setPointerCapture() {}, releasePointerCapture() {},
  } as unknown as HTMLElement
  const extension = new FibonacciRangeExtensionPrimitive()
  const primitive = new Proxy({}, { get: () => () => null })
  const handle = {
    chart: {
      chartElement: () => el,
      timeScale: () => ({ coordinateToLogical: () => null, coordinateToTime: (x: number) => x, timeToCoordinate: (x: number) => x }),
      subscribeClick() {}, subscribeCrosshairMove: (fn: typeof hover) => { hover = fn },
    },
    price: { coordinateToPrice: (y: number) => y, priceToCoordinate: (p: number) => p },
    fibonacciExtensions: extension,
    ...Object.fromEntries(['trendlines', 'rectangles', 'fibonacciRanges', 'icons', 'polylines', 'textAnchors', 'warningCircles'].map((key) => [key, primitive])),
  } as unknown as ChartHandle
  const values: Record<string, unknown> = {
    drawToolRef: tool, pointerCoarseRef: true, candlesRef: [{ time: 1 }, { time: 61 }],
    touchShapePhaseRef: 'idle', polylineDraftRef: [],
    setShapeAwaitingP2Ref: () => {},
  }
  const refs = new Proxy({}, {
    get: (_, key: string) => {
      if (!(key in values)) values[key] = null
      return {
        get current() { return values[key] },
        set current(v) { values[key] = v },
      }
    },
  }) as PriceChartInteractionRefs
  const completed: unknown[] = []
  refs.onCompleteRef.current = (input) => completed.push(input)
  const setShapeDraft = (p1: DrawingPoint, p2?: DrawingPoint | null, p3?: DrawingPoint | null) => {
    if (p2 === null) {
      refs.shapePreviewP2Ref.current = null
      refs.shapePreviewP3Ref.current = null
    } else {
      refs.shapePreviewP2Ref.current = p2 ?? refs.shapePreviewP2Ref.current ?? p1
      if (p3 !== undefined) refs.shapePreviewP3Ref.current = p3
    }
    extension.setDraft({ p1, p2: refs.shapePreviewP2Ref.current ?? undefined, p3: refs.shapePreviewP3Ref.current ?? undefined })
  }
  refs.setShapeDraftRef.current = setShapeDraft
  const clearDrafts = () => {
    refs.draftRef.current = null
    refs.shapePreviewP2Ref.current = null
    refs.shapePreviewP3Ref.current = null
    refs.polylineDraftRef.current = []
    refs.touchShapePhaseRef.current = 'idle'
    extension.setDraft(null)
  }
  bindPriceChartInteraction({ handle, chartEl: { ...el, addEventListener() {} } as HTMLElement, overlayEl: el, refs,
    helpers: { clearDrafts, selectDrawing() {}, setShapeDraft, syncInteractionLock() {}, setPolylineDraft() {}, syncDrawOverlay() {} },
  })
  const seed = () => seedTouchShapeDraft({ handle, candles: refs.candlesRef.current, draftRef: refs.draftRef, touchShapePhaseRef: refs.touchShapePhaseRef, setShapeDraft })
  const event = (name: string, x: number, y: number) => listeners.get(name)?.({ pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, preventDefault() {} } as PointerEvent)
  const tap = () => { event('pointerdown', 50, 50); event('pointerup', 50, 50) }
  const drag = (dx: number, dy: number) => { event('pointerdown', 50, 50); event('pointermove', 50 + dx, 50 + dy); event('pointerup', 50 + dx, 50 + dy) }
  return { refs, extension, completed, seed, tap, drag, clearDrafts, hover: () => hover({ point: { x: 12, y: 13 } }) }
}

test('touch extension seeds immediately, drags each anchor relative to the preview, and confirms only on the third tap', () => {
  const raf = globalThis.requestAnimationFrame
  const cancel = globalThis.cancelAnimationFrame
  globalThis.requestAnimationFrame = () => 1
  globalThis.cancelAnimationFrame = () => {}
  try {
    assert.equal(isTouchSeedShapeTool('fibonacci_range_extension'), true)
    const h = harness('fibonacci_range_extension')
    h.seed()
    assert.deepEqual(h.extension.draft, { p1: { time: 400, price: 300 }, p2: undefined, p3: undefined })
    h.hover()
    assert.equal(h.extension.draft?.p2, undefined)
    h.drag(30, 20)
    assert.equal(h.refs.touchShapePhaseRef.current, 'placing_p1')
    assert.deepEqual(h.refs.draftRef.current, { time: 430, price: 320 })
    h.tap()
    assert.equal(h.refs.touchShapePhaseRef.current, 'placing_p2')
    h.drag(25, -40)
    const second = { ...h.refs.shapePreviewP2Ref.current! }
    h.tap()
    assert.equal(h.refs.touchShapePhaseRef.current, 'placing_p3')
    assert.equal(h.completed.length, 0)
    assert.deepEqual(h.extension.draft?.p2, second)
    const thirdStart = { ...h.refs.shapePreviewP3Ref.current! }
    h.drag(-20, 35)
    assert.equal(h.refs.touchShapePhaseRef.current, 'placing_p3')
    assert.deepEqual(h.extension.draft?.p2, second)
    const third = { time: thirdStart.time - 20, price: thirdStart.price + 35 }
    assert.deepEqual(h.extension.draft?.p3, third)
    h.tap()
    assert.deepEqual(h.completed, [{ kind: 'fibonacci_range_extension', p1: { time: 430, price: 320 }, p2: third, points: [{ time: 430, price: 320 }, second, third] }])
    assert.equal(h.extension.draft, null)
    h.seed()
    assert.equal(h.refs.shapePreviewP3Ref.current, null)
    h.clearDrafts()
    assert.equal(h.extension.draft, null)
  } finally {
    globalThis.requestAnimationFrame = raf
    globalThis.cancelAnimationFrame = cancel
  }
})

test('retracement still completes on the second touch confirmation', () => {
  const h = harness('fibonacci_range')
  h.seed()
  h.tap()
  assert.equal(h.completed.length, 0)
  h.tap()
  assert.equal(h.completed.length, 1)
  assert.equal(h.refs.touchShapePhaseRef.current, 'idle')
})
