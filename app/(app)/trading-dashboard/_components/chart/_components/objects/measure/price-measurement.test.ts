import assert from 'node:assert/strict'
import test from 'node:test'
import {
  formatPriceMeasurement,
  reducePriceMeasurement,
  type PriceMeasurementPoint,
  type PriceMeasurementState,
} from './price-measurement'

const a: PriceMeasurementPoint = { x: 120, price: 1.08 }
const b: PriceMeasurementPoint = { x: 180, price: 1.08125 }
const lower: PriceMeasurementPoint = { x: 180, price: 1.07875 }

test('formats signed EURUSD delta, pips, and percentage', () => {
  assert.equal(formatPriceMeasurement(a.price, b.price), '+0.00125 · +12.5 pips · +0.12%')
  assert.equal(formatPriceMeasurement(a.price, lower.price), '-0.00125 · -12.5 pips · -0.12%')
  assert.equal(formatPriceMeasurement(a.price, a.price), '0.00000 · 0.0 pips · 0.00%')
})

test('does not format non-finite values or divide by a zero start price', () => {
  assert.equal(formatPriceMeasurement(0, 1), null)
  assert.equal(formatPriceMeasurement(Number.NaN, 1), null)
  assert.equal(formatPriceMeasurement(1, Number.POSITIVE_INFINITY), null)
})

test('fine pointer places, previews, completes, then dismisses', () => {
  let state: PriceMeasurementState = { status: 'armed', pointer: 'fine' }
  state = reducePriceMeasurement(state, { type: 'confirm', point: a })
  assert.deepEqual(state, { status: 'placing', pointer: 'fine', start: a, end: a })

  state = reducePriceMeasurement(state, { type: 'move', point: b })
  assert.deepEqual(state, { status: 'placing', pointer: 'fine', start: a, end: b })

  state = reducePriceMeasurement(state, { type: 'confirm', point: b })
  assert.deepEqual(state, { status: 'complete', start: a, end: b })
  assert.deepEqual(reducePriceMeasurement(state, { type: 'dismiss' }), { status: 'idle' })
})

test('coarse pointer seeds and confirms each movable endpoint', () => {
  let state: PriceMeasurementState = {
    status: 'placing',
    pointer: 'coarse',
    phase: 'placing_p1',
    start: a,
    end: a,
  }
  const movedStart = { x: 130, price: 1.0805 }
  const defaultEnd = { x: 130, price: 1.081 }

  state = reducePriceMeasurement(state, { type: 'move', point: movedStart })
  assert.deepEqual(state, {
    status: 'placing', pointer: 'coarse', phase: 'placing_p1', start: movedStart, end: movedStart,
  })

  state = reducePriceMeasurement(state, { type: 'confirm', point: defaultEnd })
  assert.deepEqual(state, {
    status: 'placing', pointer: 'coarse', phase: 'placing_p2', start: movedStart, end: defaultEnd,
  })

  state = reducePriceMeasurement(state, { type: 'move', point: lower })
  assert.deepEqual(state, {
    status: 'placing', pointer: 'coarse', phase: 'placing_p2', start: movedStart, end: lower,
  })

  state = reducePriceMeasurement(state, { type: 'confirm', point: lower })
  assert.deepEqual(state, { status: 'complete', start: movedStart, end: lower })
})

test('cancel always returns to idle', () => {
  const placing: PriceMeasurementState = {
    status: 'placing', pointer: 'fine', start: a, end: b,
  }
  assert.deepEqual(reducePriceMeasurement(placing, { type: 'cancel' }), { status: 'idle' })
})
