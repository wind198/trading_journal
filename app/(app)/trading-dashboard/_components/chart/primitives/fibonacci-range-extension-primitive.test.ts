import assert from 'node:assert/strict'
import test from 'node:test'
import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type { SeriesAttachedParameter, Time, SeriesType } from 'lightweight-charts'
import { FibonacciRangeExtensionPrimitive } from './fibonacci-range-extension-primitive'
import { FibonacciRangePrimitive } from './fibonacci-range-primitive'

function attach(primitive: FibonacciRangePrimitive) {
  primitive.attached({
    chart: { timeScale: () => ({ timeToCoordinate: (time: number) => time }) },
    series: { priceToCoordinate: (price: number) => 1000 - price },
    requestUpdate() {},
  } as unknown as SeriesAttachedParameter<Time, SeriesType>)
}

function labels(primitive: FibonacciRangePrimitive) {
  const result: { text: string; x: number; y: number }[] = []
  const context = new Proxy({}, {
    get: (_, key) => key === 'fillText'
      ? (text: string, x: number, y: number) => result.push({ text, x, y })
      : () => {},
    set: () => true,
  })
  primitive.updateAllViews()
  primitive.paneViews()[0].renderer()?.draw({
    useMediaCoordinateSpace: (draw: (scope: unknown) => void) => draw({ context }),
  } as unknown as CanvasRenderingTarget2D)
  return result
}

for (const direction of [1, -1]) {
  test(`extension projects from C for ${direction === 1 ? 'upward' : 'downward'} swings`, () => {
    const primitive = new FibonacciRangeExtensionPrimitive()
    attach(primitive)
    primitive.setExtensions([{ id: 'fib', points: [
      { time: 10, price: 100 },
      { time: 30, price: 100 + direction * 100 },
      { time: 50, price: 150 },
    ] }])
    const rendered = labels(primitive)
    assert.equal(rendered.length, 7)
    assert.deepEqual(rendered.map(({ text }) => Number(text.split(' ')[0])), [1, 1.236, 1.382, 1.5, 1.618, 1.786, 2])
    assert.equal(rendered[0].y, 1000 - (150 + direction * 100) - 4)
    assert.equal(rendered[4].y, 1000 - (150 + 1.618 * direction * 100) - 4)
    // C starts the levels; their width is twice the horizontal A–B span.
    assert.equal(rendered[0].x, 50 + 2 * 20 - 5)
    primitive.setSelectedId('fib')
    primitive.updateAllViews()
    assert.deepEqual(primitive.hitTestExtensionAnchor(50, 850), { id: 'fib', vertexIndex: 2 })
    assert.equal(primitive.hitTest(60, 1000 - (150 + direction * 100))?.externalId, 'fib')
    assert.equal(primitive.hitTest(100, 1000 - (150 + direction * 100)), null)
    primitive.setSelectionEnabled(false)
    assert.equal(primitive.hitTestExtensionAnchor(50, 850), null)
  })
}

test('extension previews the swing first, then levels from the third anchor, and clears on cancellation', () => {
  const primitive = new FibonacciRangeExtensionPrimitive()
  attach(primitive)
  const p1 = { time: 10, price: 100 }
  const p2 = { time: 30, price: 200 }
  primitive.setDraft({ p1, p2 })
  assert.equal(labels(primitive).length, 0)
  primitive.setDraft({ p1, p2, p3: { time: 50, price: 150 } })
  assert.equal(labels(primitive).length, 7)
  assert.equal(primitive.hitTest(60, 850), null)
  primitive.setDraft(null)
  assert.equal(labels(primitive).length, 0)
})

test('retracement retains its two-anchor levels and double-span width', () => {
  const primitive = new FibonacciRangePrimitive([{ id: 'range', p1: { time: 30, price: 100 }, p2: { time: 10, price: 200 } }])
  attach(primitive)
  const rendered = labels(primitive)
  assert.equal(rendered[0].text, '0 (200)')
  assert.equal(rendered[6].text, '1 (100)')
  assert.equal(rendered[0].x, 50 - 5)
})
