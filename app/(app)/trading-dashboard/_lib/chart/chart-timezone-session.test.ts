import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SESSION_LINE_SLOTS,
  sessionSlotId,
  sessionVerticalLineTimes,
} from './chart-timezone'

test('sessionVerticalLineTimes includes every slot by default', () => {
  const times = sessionVerticalLineTimes()
  assert.equal(times.length, SESSION_LINE_SLOTS.length * 4)
  assert.ok(times.every((t, i) => i === 0 || t >= times[i - 1]!))
})

test('sessionVerticalLineTimes filters to enabled slot ids only', () => {
  const first = sessionSlotId(SESSION_LINE_SLOTS[0]!)
  const last = sessionSlotId(SESSION_LINE_SLOTS[SESSION_LINE_SLOTS.length - 1]!)
  const times = sessionVerticalLineTimes(new Set([first, last]))
  assert.equal(times.length, 8)
  const all = sessionVerticalLineTimes()
  // Two slots × 4 day offsets, same order as full list subset.
  let i = 0
  for (let day = 0; day < 4; day++) {
    const base = day * SESSION_LINE_SLOTS.length
    assert.equal(times[i++], all[base])
    assert.equal(times[i++], all[base + SESSION_LINE_SLOTS.length - 1])
  }
})

test('sessionVerticalLineTimes with empty enabled set yields no lines', () => {
  assert.deepEqual(sessionVerticalLineTimes(new Set()), [])
})
