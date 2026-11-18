import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defaultIndicatorsByPane,
  parseChartOverlaySettings,
  setIndicatorAllPanes,
  paneIndicators,
  DEFAULT_OVERLAY_SETTINGS,
} from './chart-indicator-pane-settings'

test('defaultIndicatorsByPane: bollinger on, ichimoku off', () => {
  const map = defaultIndicatorsByPane()
  for (const id of ['4h', '1h', '15m', '3m'] as const) {
    assert.equal(map[id].bollinger, true)
    assert.equal(map[id].ichimoku, false)
  }
})

test('setIndicatorAllPanes', () => {
  const next = setIndicatorAllPanes(DEFAULT_OVERLAY_SETTINGS, 'ichimoku', true)
  assert.equal(next.indicatorsByPane['3m'].ichimoku, true)
  assert.equal(next.indicatorsByPane['4h'].ichimoku, true)
  const off = setIndicatorAllPanes(next, 'bollinger', false)
  assert.equal(off.indicatorsByPane['1h'].bollinger, false)
})

test('parseOverlaySettings: legacy root bollinger/ichimoku', () => {
  const parsed = parseChartOverlaySettings(
    JSON.stringify({ bollinger: false, ichimoku: true }),
  )
  assert.equal(parsed.indicatorsByPane['15m'].bollinger, false)
  assert.equal(parsed.indicatorsByPane['15m'].ichimoku, true)
})

test('parseOverlaySettings: partial pane map fills defaults', () => {
  const parsed = parseChartOverlaySettings(
    JSON.stringify({
      indicatorsByPane: { '3m': { bollinger: false, ichimoku: true } },
    }),
  )
  assert.equal(parsed.indicatorsByPane['3m'].bollinger, false)
  assert.equal(parsed.indicatorsByPane['3m'].ichimoku, true)
  assert.equal(parsed.indicatorsByPane['4h'].bollinger, true)
  assert.equal(parsed.indicatorsByPane['4h'].ichimoku, false)
})

test('paneIndicators unknown pane uses defaults', () => {
  const toggles = paneIndicators(DEFAULT_OVERLAY_SETTINGS, '5m')
  assert.deepEqual(toggles, { bollinger: true, ichimoku: false })
})