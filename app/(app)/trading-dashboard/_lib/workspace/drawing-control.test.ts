import assert from 'node:assert/strict'
import { test } from 'node:test'
import { activatePane, resolveDrawingControl, toggleDrawingMode, cancelPaneMode, type DrawingControl } from './drawing-control'
const initial: DrawingControl = { paneId: '15m', mode: { kind: 'draw', tool: 'rectangle' } }
test('switching pane cancels the old tool rather than transferring it', () => {
  assert.deepEqual(activatePane(initial, '3m'), { paneId: '3m', mode: { kind: 'idle' } })
  assert.equal(activatePane(initial, '15m'), initial)
})
test('hidden pane resolves to visible pane with idle mode', () => {
  assert.deepEqual(resolveDrawingControl(initial, ['4h']), { paneId: '4h', mode: { kind: 'idle' } })
})
test('measure replaces drawing and repeated mode toggles off', () => {
  const next = toggleDrawingMode(initial, { kind: 'measure' })
  assert.equal(next.mode.kind, 'measure')
  assert.equal(toggleDrawingMode(next, { kind: 'measure' }).mode.kind, 'idle')
})
test('inactive pane cancellation does not clear active tool', () => {
  assert.equal(cancelPaneMode(initial, '3m', 'draw'), initial)
  assert.equal(cancelPaneMode(initial, '15m', 'draw').mode.kind, 'idle')
})
