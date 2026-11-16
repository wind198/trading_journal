import assert from 'node:assert/strict'
import test from 'node:test'
import type { ChartHandle } from '../../price-chart-handle'
import { TrendlineEditBehavior } from '../../_components/objects/trendline/trendline-edit-behavior'
import { RectangleEditBehavior } from '../../_components/objects/rect/rectangle-edit-behavior'
import { FibonacciRangeEditBehavior } from '../../_components/objects/fibonacci-range/fibonacci-range-edit-behavior'
import { WarningCircleEditBehavior } from '../../_components/objects/warning-circle/warning-circle-edit-behavior'
import { IconEditBehavior } from '../../_components/objects/icon/icon-edit-behavior'
import { TextAnchorEditBehavior } from '../../_components/objects/text/text-anchor-edit-behavior'
import type { EditProbe, ToolEditSession } from './edit-contract'

const p1 = { time: 10, price: 100 }
const p2 = { time: 20, price: 110 }
const screen = { x: 5, y: 6 }
const drawing = { id: 'selected', p1, p2 }

function session(probe: EditProbe): ToolEditSession {
  assert.ok(probe && probe !== 'blocked')
  return probe
}

function pairPrimitive(endpoint: 'p1' | 'p2' = 'p2') {
  return {
    hitTestAnchor: () => ({ id: 'selected', endpoint }),
    hitTest: () => ({ externalId: 'selected' }),
    getDrawing: () => drawing,
  }
}

test('trendline and rectangle each own their anchor edit', () => {
  const trendline = new TrendlineEditBehavior(pairPrimitive() as unknown as ChartHandle['trendlines'], () => [drawing])
  const rectangle = new RectangleEditBehavior(pairPrimitive('p1') as unknown as ChartHandle['rectangles'], () => [drawing])
  const next = { time: 30, price: 90 }
  assert.deepEqual(session(trendline.beginAnchor('selected', screen)).move(next),
    { kind: 'two-point', id: 'selected', p1, p2: next })
  assert.deepEqual(session(rectangle.beginAnchor('selected', screen)).move(next),
    { kind: 'two-point', id: 'selected', p1: next, p2 })
  assert.equal(trendline.beginAnchor('other', screen), 'blocked')
})

test('Fibonacci range owns body translation separately from anchor movement', () => {
  const range = new FibonacciRangeEditBehavior(pairPrimitive() as unknown as ChartHandle['fibonacciRanges'], () => [drawing])
  assert.deepEqual(range.beginBody('selected', screen, { time: 1, price: 2 })?.move({ time: 4, price: 7 }),
    { kind: 'two-point', id: 'selected', p1: { time: 13, price: 105 }, p2: { time: 23, price: 115 } })
  assert.deepEqual(session(range.beginAnchor('selected', screen)).move({ time: 25, price: 120 }),
    { kind: 'two-point', id: 'selected', p1, p2: { time: 25, price: 120 } })
})

test('warning circle center edit keeps the rim offset', () => {
  const circle = new WarningCircleEditBehavior(pairPrimitive('p1') as unknown as ChartHandle['warningCircles'], () => [drawing])
  assert.deepEqual(session(circle.beginAnchor('selected', screen)).move({ time: 12, price: 103 }),
    { kind: 'two-point', id: 'selected', p1: { time: 12, price: 103 }, p2: { time: 22, price: 113 } })
})

test('icon and text each expose press hit and single-point edit', () => {
  const primitive = { hitTest: () => ({ externalId: 'selected' }), hitTestAnchor: () => ({ id: 'selected', endpoint: 'p1' }), getDrawing: (id: string) => id === 'selected' ? drawing : null }
  const icon = new IconEditBehavior(primitive as unknown as ChartHandle['icons'], () => [drawing as never])
  const text = new TextAnchorEditBehavior(primitive as unknown as ChartHandle['textAnchors'], () => [drawing as never])
  for (const behavior of [icon, text]) {
    assert.equal(behavior.pressHit(screen), 'selected')
    assert.deepEqual(behavior.beginPress('selected')?.move({ time: 11, price: 12 }),
      { kind: 'two-point', id: 'selected', p1: { time: 11, price: 12 }, p2: { time: 11, price: 12 } })
    assert.equal(behavior.beginPress('other'), null)
  }
})
