import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DrawingEditPreviewScheduler,
  patchTwoPointDrawing,
} from './drawing-edit-preview'
import type { ChartHandle } from './price-chart-handle'

function trendlineHandle(initial: { id: string; p1: { time: number; price: number }; p2: { time: number; price: number } }) {
  let lines = [initial]
  const setCalls: unknown[] = []
  const handle = {
    trendlines: {
      lines,
      getDrawing: (id: string) => lines.find((item) => item.id === id) ?? null,
      setLines: (next: typeof lines) => {
        lines = [...next]
        handle.trendlines.lines = lines
        setCalls.push(next)
      },
    },
    rectangles: { getDrawing: () => null, rects: [], setRects: () => {} },
    fibonacciRanges: { getDrawing: () => null, ranges: [], setRanges: () => {} },
    fibonacciExtensions: { getDrawing: () => null, ranges: [], setExtensions: () => {} },
    warningCircles: { getDrawing: () => null, circles: [], setCircles: () => {} },
    icons: { getDrawing: () => null, icons: [], setIcons: () => {} },
    textAnchors: { getDrawing: () => null, anchors: [], setAnchors: () => {} },
    polylines: { getDrawing: () => null, polylines: [], setPolylines: () => {} },
  } as unknown as ChartHandle
  return { handle, setCalls, getLines: () => lines }
}

test('patchTwoPointDrawing updates only the matched trendline', () => {
  const h = trendlineHandle({ id: 't1', p1: { time: 1, price: 2 }, p2: { time: 3, price: 4 } })
  assert.equal(
    patchTwoPointDrawing(h.handle, 't1', { time: 10, price: 20 }, { time: 30, price: 40 }),
    true,
  )
  assert.deepEqual(h.getLines(), [
    { id: 't1', p1: { time: 10, price: 20 }, p2: { time: 30, price: 40 } },
  ])
  assert.equal(patchTwoPointDrawing(h.handle, 'missing', { time: 1, price: 1 }, { time: 2, price: 2 }), false)
})

test('DrawingEditPreviewScheduler coalesces to one patch then flush applies latest', async () => {
  const queued: FrameRequestCallback[] = []
  const previousRaf = globalThis.requestAnimationFrame
  const previousCancel = globalThis.cancelAnimationFrame
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    queued.push(cb)
    return queued.length
  }) as typeof requestAnimationFrame
  globalThis.cancelAnimationFrame = ((id: number) => {
    queued[id - 1] = () => {}
  }) as typeof cancelAnimationFrame

  try {
    const h = trendlineHandle({ id: 't1', p1: { time: 1, price: 2 }, p2: { time: 3, price: 4 } })
    let restored = 0
    const scheduler = new DrawingEditPreviewScheduler(h.handle, () => {
      restored += 1
    })
    scheduler.scheduleTwoPoint('t1', { time: 5, price: 6 }, { time: 7, price: 8 })
    scheduler.scheduleTwoPoint('t1', { time: 15, price: 16 }, { time: 17, price: 18 })
    assert.equal(h.setCalls.length, 0)
    assert.equal(queued.length, 1)
    queued[0]!(0)
    assert.equal(h.setCalls.length, 1)
    assert.deepEqual(h.getLines()[0], {
      id: 't1',
      p1: { time: 15, price: 16 },
      p2: { time: 17, price: 18 },
    })
    scheduler.scheduleTwoPoint('t1', { time: 25, price: 26 }, { time: 27, price: 28 })
    const flushed = scheduler.flush()
    assert.deepEqual(flushed, {
      kind: 'two-point',
      id: 't1',
      p1: { time: 25, price: 26 },
      p2: { time: 27, price: 28 },
    })
    assert.deepEqual(h.getLines()[0]?.p1, { time: 25, price: 26 })
    scheduler.discardAndRestore()
    assert.equal(restored, 1)
  } finally {
    globalThis.requestAnimationFrame = previousRaf
    globalThis.cancelAnimationFrame = previousCancel
  }
})
