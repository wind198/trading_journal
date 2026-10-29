import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildVolumeProfile, VALUE_AREA_RATIO } from './volume-profile'

function bin(price: number, tickCount: number) {
  return { price, tickCount }
}

test('buildVolumeProfile: empty / zero volume → null', () => {
  assert.equal(buildVolumeProfile([]), null)
  assert.equal(buildVolumeProfile([bin(1.1, 0)]), null)
})

test('buildVolumeProfile: single bin POC and VA edges', () => {
  const frame = buildVolumeProfile([bin(10, 5)], 1)
  assert.ok(frame)
  assert.equal(frame.poc, 10)
  assert.equal(frame.vah, 10.5)
  assert.equal(frame.val, 9.5)
})

test('buildVolumeProfile: POC is max count, lowest price on ties', () => {
  const frame = buildVolumeProfile(
    [bin(3, 10), bin(1, 10), bin(2, 4)],
    1,
  )
  assert.ok(frame)
  assert.equal(frame.poc, 1)
})

test('buildVolumeProfile: unimodal 70% expand, equal sides prefer above', () => {
  // counts 1,2,10,2,1 — total 16, target 11.2; POC 10 then +above 2 meets target
  const frame = buildVolumeProfile(
    [bin(1, 1), bin(2, 2), bin(3, 10), bin(4, 2), bin(5, 1)],
    1,
  )
  assert.ok(frame)
  assert.equal(frame.poc, 3)
  assert.equal(frame.val, 2.5)
  assert.equal(frame.vah, 4.5)
  const covered =
    frame.bins
      .filter((row) => row.price >= 3 && row.price <= 4)
      .reduce((sum, row) => sum + row.tickCount, 0)
  assert.ok(covered >= 16 * VALUE_AREA_RATIO)
})

test('buildVolumeProfile: expands toward the heavier side', () => {
  const frame = buildVolumeProfile(
    [bin(1, 1), bin(2, 10), bin(3, 8), bin(4, 7)],
    1,
  )
  assert.ok(frame)
  assert.equal(frame.poc, 2)
  assert.equal(frame.val, 1.5)
  assert.equal(frame.vah, 4.5)
})
