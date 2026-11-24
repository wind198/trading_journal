import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_LAYOUT, normalizeLayout, resizePortrait, splitTracks, portraitTracks } from './layout-preferences'
test('invalid storage falls back to safe defaults', () => {
  assert.deepEqual(normalizeLayout(null), DEFAULT_LAYOUT)
  assert.deepEqual(normalizeLayout({ fourPortrait: [0, 20], fourWide: { row: NaN, column: 100 }, focusMode: 'true' }), { ...DEFAULT_LAYOUT, fourWide: { row: 50, column: 75 } })
})
test('valid preferences round trip', () => {
  const prefs = { ...DEFAULT_LAYOUT, focusMode: true, focusWide: 65 }
  assert.deepEqual(normalizeLayout(JSON.parse(JSON.stringify(prefs))), prefs)
})
test('portrait resizing preserves other weights and bounds', () => {
  assert.deepEqual(resizePortrait([25,25,25,25], 2, 100), [25,25,85,25])
  assert.deepEqual(resizePortrait([25,25,25,25], -1, 50), [25,25,25,25])
  assert.equal(portraitTracks([25,25,50,25]), 'minmax(0, 25fr) minmax(0, 25fr) minmax(0, 50fr) minmax(0, 25fr)')
})
test('split tracks always leave room for both panes', () => {
  assert.equal(splitTracks(90), 'minmax(0, 75fr) minmax(0, 25fr)')
  assert.equal(splitTracks(30), 'minmax(0, 30fr) minmax(0, 70fr)')
})
