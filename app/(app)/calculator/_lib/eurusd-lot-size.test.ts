import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateEurusdLotSize } from './eurusd-lot-size'

test('calculates the workbook EURUSD example and rounds down to 0.01 lots', () => {
  assert.deepEqual(calculateEurusdLotSize(40, 60), {
    rawLots: 2 / 3,
    lotSize: 0.66,
    actualRiskUsd: 39.6,
  })
})

test('rounding down never exceeds the requested risk', () => {
  assert.deepEqual(calculateEurusdLotSize(1, 3), {
    rawLots: 1 / 3,
    lotSize: 0.33,
    actualRiskUsd: 0.99,
  })
})

test('returns zero lots when the requested risk is below the minimum lot step', () => {
  assert.deepEqual(calculateEurusdLotSize(0.5, 100), {
    rawLots: 0.005,
    lotSize: 0,
    actualRiskUsd: 0,
  })
})

test('rejects zero, negative, and non-finite inputs', () => {
  assert.equal(calculateEurusdLotSize(0, 60), null)
  assert.equal(calculateEurusdLotSize(40, 0), null)
  assert.equal(calculateEurusdLotSize(-40, 60), null)
  assert.equal(calculateEurusdLotSize(Number.NaN, 60), null)
})
