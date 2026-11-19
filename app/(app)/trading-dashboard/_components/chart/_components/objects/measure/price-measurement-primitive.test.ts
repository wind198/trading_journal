import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPriceMeasurementGeometry } from './price-measurement-primitive'
import type { PriceMeasurementState } from './price-measurement'

const state: PriceMeasurementState = {
  status: 'complete',
  start: { x: 120, price: 1.08 },
  end: { x: 180, price: 1.08125 },
}

test('builds a vertical ruler at the start x with ordered endpoints', () => {
  const geometry = buildPriceMeasurementGeometry(state, (price) =>
    price === 1.08 ? 220 : 100, 500, 300)
  assert.deepEqual(geometry, {
    x: 120,
    startY: 220,
    endY: 100,
    top: 100,
    bottom: 220,
    labelY: 160,
    label: '+0.00125 · +12.5 pips · +0.12%',
  })
})

test('clamps the ruler x inside the pane and ignores unavailable coordinates', () => {
  const outside: PriceMeasurementState = {
    ...state,
    start: { ...state.start, x: 900 },
  }
  assert.equal(buildPriceMeasurementGeometry(outside, () => 100, 500, 300)?.x, 488)
  assert.equal(buildPriceMeasurementGeometry(state, () => null, 500, 300), null)
  assert.equal(buildPriceMeasurementGeometry({ status: 'idle' }, () => 100, 500, 300), null)
})
