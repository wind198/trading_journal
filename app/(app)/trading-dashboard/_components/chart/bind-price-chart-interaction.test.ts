import assert from 'node:assert/strict'
import test from 'node:test'
import { bindPriceChartInteraction, isTouchSeedShapeTool, type PriceChartInteractionRefs } from './bind-price-chart-interaction'
import type { ChartHandle } from './price-chart-handle'
import type { ChartDrawingKind, DrawingPoint } from '../../_lib/chart/chart-drawings'
import { FibonacciRangeExtensionPrimitive } from './_components/objects/fibonacci-extension/fibonacci-range-extension-primitive'

function harness(tool: ChartDrawingKind, coarse = true) {
  const listeners = new Map<string, (event: PointerEvent) => void>()
  const captured: number[] = []
  const released: number[] = []
  let hover: (event: { point: { x: number; y: number } }) => void = () => {}
  const el = {
    clientWidth: 800, clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    addEventListener: (name: string, fn: (event: PointerEvent) => void) => listeners.set(name, fn),
    removeEventListener() {},
    setPointerCapture(pointerId: number) { captured.push(pointerId) },
    releasePointerCapture(pointerId: number) { released.push(pointerId) },
  } as unknown as HTMLElement
  const extension = new FibonacciRangeExtensionPrimitive()
  const primitive = new Proxy({}, { get: () => () => null })
  const handle = {
    chart: {
      chartElement: () => el,
      timeScale: () => ({ coordinateToLogical: () => null, coordinateToTime: (x: number) => x < 0 ? null : x, timeToCoordinate: (x: number) => x }),
      subscribeClick() {}, unsubscribeClick() {},
      subscribeCrosshairMove: (fn: typeof hover) => { hover = fn }, unsubscribeCrosshairMove() {},
    },
    price: { coordinateToPrice: (y: number) => y, priceToCoordinate: (p: number) => p },
    fibonacciExtensions: extension,
    ...Object.fromEntries(['trendlines', 'rectangles', 'fibonacciRanges', 'icons', 'polylines', 'textAnchors', 'warningCircles'].map((key) => [key, primitive])),
  } as unknown as ChartHandle
  const values: Record<string, unknown> = {
    drawToolRef: tool, pointerCoarseRef: coarse, candlesRef: [{ time: 1 }, { time: 61 }],
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
  const draftCalls: DrawingPoint[][] = []
  refs.onCompleteRef.current = (input) => completed.push(input)
  const setShapeDraft = (p1: DrawingPoint, p2?: DrawingPoint | null, p3?: DrawingPoint | null) => {
    draftCalls.push([p1, ...(p2 ? [p2] : []), ...(p3 ? [p3] : [])])
    extension.setDraft({ p1, p2: p2 ?? undefined, p3: p3 ?? undefined })
  }
  refs.setShapeDraftRef.current = setShapeDraft
  const clearDrafts = () => {
    extension.setDraft(null)
  }
  const unbind = bindPriceChartInteraction({ handle, chartEl: { ...el, addEventListener() {} } as HTMLElement, overlayEl: el, refs,
    helpers: { clearDrafts, selectDrawing() {}, setShapeDraft, syncInteractionLock() {}, setPolylineDraft() {}, syncDrawOverlay() {} },
  })
  const seed = () => tool === 'fibonacci_range_extension'
    ? refs.seedCoarseThreePointRef.current?.()
    : refs.seedCoarseTwoPointRef.current?.(tool as 'rectangle' | 'trendline' | 'fibonacci_range' | 'warning_circle')
  const event = (name: string, x: number, y: number) => listeners.get(name)?.({ pointerId: 1, pointerType: coarse ? 'touch' : 'mouse', clientX: x, clientY: y, preventDefault() {} } as PointerEvent)
  const tap = () => { event('pointerdown', 50, 50); event('pointerup', 50, 50) }
  const drag = (dx: number, dy: number) => { event('pointerdown', 50, 50); event('pointermove', 50 + dx, 50 + dy); event('pointerup', 50 + dx, 50 + dy) }
  return { refs, extension, completed, draftCalls, captured, released, seed, tap, drag, clearDrafts, event, unbind, hover: () => hover({ point: { x: 12, y: 13 } }) }
}

for (const tool of ['rectangle', 'trendline', 'fibonacci_range', 'warning_circle'] as const) {
  test(`${tool} fine create uses InteractionStore create runtime`, () => {
    const h = harness(tool, false)
    h.event('pointerdown', -1, 25)
    h.event('pointerup', -1, 25)
    assert.equal(h.draftCalls.length, 0)
    h.event('pointerdown', 120, 25)
    h.event('pointerup', 120, 25)
    assert.deepEqual(h.draftCalls, [[{ time: 120, price: 25 }]])
    assert.equal(h.completed.length, 0)

    h.event('pointerdown', -1, 20)
    h.event('pointerup', -1, 20)
    assert.equal(h.draftCalls.length, 1)
    assert.equal(h.completed.length, 0)

    h.event('pointerdown', 60, 20)
    h.event('pointerup', 60, 20)
    assert.deepEqual(h.completed, [{
      kind: tool,
      p1: { time: 120, price: 25 },
      p2: { time: 60, price: 20 },
    }])
  })
}

test('fine pointer hover previews the second point without changing session state', () => {
  const h = harness('rectangle', false)
  h.event('pointerdown', 120, 25)
  h.event('pointerup', 120, 25)
  h.hover()
  assert.deepEqual(h.draftCalls.at(-1), [{ time: 120, price: 25 }, { time: 12, price: 13 }])
  assert.equal(h.completed.length, 0)
})

test('fine pointer cancellation and tool switch clear the old session without completion', () => {
  const h = harness('rectangle', false)
  h.event('pointerdown', 120, 25)
  h.event('pointerup', 120, 25)
  h.event('pointercancel', 120, 25)
  assert.deepEqual(h.completed, [])

  h.event('pointerdown', 120, 25)
  h.event('pointerup', 120, 25)
  h.refs.interactionCancelRef.current?.()
  h.refs.drawToolRef.current = 'trendline'
  h.event('pointerdown', 60, 20)
  h.event('pointerup', 60, 20)
  assert.deepEqual(h.draftCalls.at(-1), [{ time: 60, price: 20 }])
  assert.deepEqual(h.completed, [])
  h.unbind()
  assert.equal(h.refs.seedCoarseTwoPointRef.current, null)
})

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
    assert.deepEqual(h.extension.draft, { p1: { time: 430, price: 320 }, p2: undefined, p3: undefined })
    h.tap()
    assert.ok(h.extension.draft?.p2)
    const second = h.extension.draft!.p2 as DrawingPoint
    h.drag(25, -40)
    assert.deepEqual(h.extension.draft?.p2, { time: second.time + 25, price: second.price - 40 })
    h.tap()
    assert.equal(h.completed.length, 0)
    assert.ok(h.extension.draft?.p3)
    const thirdStart = h.extension.draft!.p3 as DrawingPoint
    h.drag(-20, 35)
    const third = { time: thirdStart.time - 20, price: thirdStart.price + 35 }
    assert.deepEqual(h.extension.draft?.p3, third)
    const secondAfter = h.extension.draft!.p2 as DrawingPoint
    h.tap()
    assert.deepEqual(h.completed, [{
      kind: 'fibonacci_range_extension',
      p1: { time: 430, price: 320 },
      p2: third,
      points: [{ time: 430, price: 320 }, secondAfter, third],
    }])
    assert.equal(h.extension.draft, null)
    h.seed()
    assert.equal((h.extension.draft as { p3?: DrawingPoint } | null)?.p3 ?? null, null)
    h.clearDrafts()
    assert.equal(h.extension.draft, null)
  } finally {
    globalThis.requestAnimationFrame = raf
    globalThis.cancelAnimationFrame = cancel
  }
})

test('coarse extension cancellation discards a queued preview and releases capture', () => {
  const raf = globalThis.requestAnimationFrame
  const cancel = globalThis.cancelAnimationFrame
  let queued: FrameRequestCallback | null = null
  globalThis.requestAnimationFrame = (callback) => { queued = callback; return 1 }
  globalThis.cancelAnimationFrame = () => {}
  try {
    const h = harness('fibonacci_range_extension')
    h.seed()
    h.event('pointerdown', 50, 50)
    h.event('pointermove', 80, 70)
    const previewsBeforeCancel = h.draftCalls.length
    h.event('pointercancel', 80, 70)
    assert.equal(h.extension.draft, null)
    assert.deepEqual(h.completed, [])
    assert.deepEqual(h.released, [1])
    if (queued) (queued as FrameRequestCallback)(0)
    assert.equal(h.draftCalls.length, previewsBeforeCancel)
  } finally {
    globalThis.requestAnimationFrame = raf
    globalThis.cancelAnimationFrame = cancel
  }
})

test('invalid coarse extension drag leaves its active anchor unchanged', () => {
  const h = harness('fibonacci_range_extension')
  h.seed()
  h.event('pointerdown', 50, 50)
  h.event('pointermove', -500, 50)
  h.event('pointerup', -500, 50)
  assert.deepEqual(h.extension.draft, { p1: { time: 400, price: 300 }, p2: undefined, p3: undefined })
  assert.deepEqual(h.completed, [])
})

test('fine-pointer extension still completes on its third placement tap', () => {
  const h = harness('fibonacci_range_extension', false)
  for (const [x, y] of [[100, 10], [130, 12], [160, 11]]) {
    h.event('pointerdown', x, y)
    h.event('pointerup', x, y)
  }
  assert.deepEqual(h.completed, [{
    kind: 'fibonacci_range_extension',
    p1: { time: 100, price: 10 },
    p2: { time: 160, price: 11 },
    points: [{ time: 100, price: 10 }, { time: 130, price: 12 }, { time: 160, price: 11 }],
  }])
})

test('retracement still completes on the second touch confirmation', () => {
  const h = harness('fibonacci_range')
  h.seed()
  h.tap()
  assert.equal(h.completed.length, 0)
  h.tap()
  assert.equal(h.completed.length, 1)
})

for (const tool of ['rectangle', 'trendline', 'fibonacci_range', 'warning_circle'] as const) {
  test(`${tool} coarse session seeds, drags both anchors, and confirms only on taps`, () => {
    const raf = globalThis.requestAnimationFrame
    const cancel = globalThis.cancelAnimationFrame
    globalThis.requestAnimationFrame = () => 1
    globalThis.cancelAnimationFrame = () => {}
    try {
      const h = harness(tool)
      h.seed()
      assert.deepEqual(h.draftCalls.at(-1), [{ time: 400, price: 300 }])
      h.drag(30, 20)
      assert.deepEqual(h.draftCalls.at(-1), [{ time: 430, price: 320 }])
      assert.equal(h.completed.length, 0)
      h.tap()
      assert.ok(h.draftCalls.at(-1)?.[1])
      h.drag(25, -40)
      const p2 = h.draftCalls.at(-1)![1]!
      h.tap()
      assert.deepEqual(h.completed, [{ kind: tool, p1: { time: 430, price: 320 }, p2 }])
    } finally {
      globalThis.requestAnimationFrame = raf
      globalThis.cancelAnimationFrame = cancel
    }
  })
}

test('coarse pointer cancellation discards a queued preview and clears the session', () => {
  const raf = globalThis.requestAnimationFrame
  const cancel = globalThis.cancelAnimationFrame
  let queued: FrameRequestCallback | null = null
  globalThis.requestAnimationFrame = (callback) => { queued = callback; return 1 }
  globalThis.cancelAnimationFrame = () => {}
  try {
    const h = harness('rectangle')
    h.seed()
    h.event('pointerdown', 50, 50)
    h.event('pointermove', 80, 70)
    const previewsBeforeCancel = h.draftCalls.length
    h.event('pointercancel', 80, 70)
    assert.equal(h.extension.draft?.p2 ?? null, null)
    assert.deepEqual(h.completed, [])
    assert.deepEqual(h.captured, [1])
    assert.deepEqual(h.released, [1])
    if (queued) (queued as FrameRequestCallback)(0)
    assert.equal(h.draftCalls.length, previewsBeforeCancel)
  } finally {
    globalThis.requestAnimationFrame = raf
    globalThis.cancelAnimationFrame = cancel
  }
})

test('coarse movement threshold distinguishes a tap from a drag', () => {
  const h = harness('rectangle')
  h.seed()
  h.event('pointerdown', 50, 50)
  h.event('pointermove', 55, 55)
  h.event('pointerup', 55, 55)
  assert.deepEqual(h.draftCalls.at(-1), [
    { time: 400, price: 300 },
    { time: 580, price: 300.075 },
  ])
  assert.deepEqual(h.completed, [])
})

test('invalid coarse drag leaves the anchor unchanged and does not confirm', () => {
  const h = harness('rectangle')
  h.seed()
  h.event('pointerdown', 50, 50)
  h.event('pointermove', -500, 50)
  h.event('pointerup', -500, 50)
  assert.deepEqual(h.draftCalls.at(-1), [{ time: 400, price: 300 }])
  assert.deepEqual(h.completed, [])
})

test('coarse tool switch cancels the prior session and chart unbind releases capture', () => {
  const h = harness('rectangle')
  h.seed()
  h.refs.drawToolRef.current = 'trendline'
  h.event('pointerdown', 50, 50)
  assert.ok(h.draftCalls.some((call) => call[0]?.time === 400))
  h.unbind()
  assert.equal(h.refs.seedCoarseTwoPointRef.current, null)
  assert.deepEqual(h.captured, [1])
  assert.deepEqual(h.released, [1])
  assert.deepEqual(h.completed, [])
})
