import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SESSION_LINE_SLOTS,
  sessionVerticalLines, defaultSessionOpenTimes, normalizeSessionOpenTimes, parseSessionOpenTime, unixAtChartZone,
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

test('named session identity survives editable clock times and overlaps', () => {
  const times = defaultSessionOpenTimes()
  times.sydney = {hour:19,minute:30}
  const lines = sessionVerticalLines(null,times,new Date('2026-11-25T12:00:00Z'))
  assert.equal(lines.length,16)
  const sameTime = lines.filter(l=>l.time===unixAtChartZone(2026,11,25,19,30))
  assert.deepEqual(sameTime.map(l=>l.id),['sydney','newyork'])
  assert.notEqual(sameTime[0]!.color,sameTime[1]!.color)
})
test('clock validation rejects malformed or out of range values', () => {
  assert.equal(parseSessionOpenTime('24:00'),null)
  assert.equal(parseSessionOpenTime('07:60'),null)
  assert.deepEqual(parseSessionOpenTime('19:30'),{hour:19,minute:30})
  assert.deepEqual(normalizeSessionOpenTimes({london:{hour:25,minute:0}}).london,defaultSessionOpenTimes().london)
})
