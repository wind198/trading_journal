import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  defaultIndicatorsByPane,
  parseChartOverlaySettings,
  setIndicatorAllPanes,
  paneIndicators,
  regimeIndicatorVisibility,
  DEFAULT_OVERLAY_SETTINGS,
} from './chart-indicator-pane-settings'

test('defaultIndicatorsByPane: migrated indicators default on where supported', () => {
  const map = defaultIndicatorsByPane()
  for (const id of ['4h', '1h', '15m', '3m'] as const) {
    assert.equal(map[id].bollinger, true)
    assert.equal(map[id].ichimoku, false)
    assert.equal(map[id].regime, id === '15m' || id === '3m')
    assert.equal(map[id].force, true)
    assert.equal(map[id].engulfing, true)
    assert.equal(map[id].doji, true)
    assert.equal(map[id].doublePattern, false)
    assert.equal(map[id].keyLevels, true)
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

test('double pattern knob persists per pane and defaults off elsewhere', () => {
  const parsed = parseChartOverlaySettings(JSON.stringify({
    indicatorsByPane: { '3m': { doublePattern: true } },
  }))
  assert.equal(parsed.indicatorsByPane['3m'].doublePattern, true)
  assert.equal(parsed.indicatorsByPane['15m'].doublePattern, false)
})

test('paneIndicators unknown pane uses defaults', () => {
  const toggles = paneIndicators(DEFAULT_OVERLAY_SETTINGS, '5m')
  assert.deepEqual(toggles, {
    bollinger: true,
    ichimoku: false,
    regime: true,
    force: true,
    engulfing: true,
    doji: true,
    doublePattern: false,
    keyLevels: true,
  })
})

test('paneIndicators forces regime off on higher timeframes', () => {
  const settings = {
    ...DEFAULT_OVERLAY_SETTINGS,
    indicatorsByPane: {
      ...DEFAULT_OVERLAY_SETTINGS.indicatorsByPane,
      '4h': { ...DEFAULT_OVERLAY_SETTINGS.indicatorsByPane['4h'], regime: true },
      '1h': { ...DEFAULT_OVERLAY_SETTINGS.indicatorsByPane['1h'], regime: true },
    },
  }
  assert.equal(paneIndicators(settings, '4h').regime, false)
  assert.equal(paneIndicators(settings, '1h').regime, false)
  assert.equal(paneIndicators(settings, '15m').regime, true)
  assert.equal(paneIndicators(settings, '3m').regime, true)
})

test('auto indicator setting defaults off and survives persisted settings', () => {
  assert.equal(parseChartOverlaySettings('{}').autoIndicatorsByRegime, false)
  assert.equal(parseChartOverlaySettings('{"autoIndicatorsByRegime":true}').autoIndicatorsByRegime, true)
})

test('auto regime visibility overrides but preserves saved manual choices', () => {
  const manual = { bollinger: false, ichimoku: true }
  assert.deepEqual(regimeIndicatorVisibility(false, 'CHOPPY', manual), manual)
  assert.deepEqual(regimeIndicatorVisibility(true, 'CHOPPY', manual), { bollinger: true, ichimoku: false })
  assert.deepEqual(regimeIndicatorVisibility(true, 'UP', manual), { bollinger: false, ichimoku: true })
  assert.deepEqual(regimeIndicatorVisibility(true, 'DOWN', manual), { bollinger: false, ichimoku: true })
  assert.deepEqual(regimeIndicatorVisibility(true, null, manual), { bollinger: false, ichimoku: false })
  assert.deepEqual(manual, { bollinger: false, ichimoku: true })
})

test('market times and visibility persist by stable session identity', () => {
 const parsed=parseChartOverlaySettings(JSON.stringify({sessionSlots:{london:false},sessionOpenTimes:{london:{hour:15,minute:0}}}))
 assert.equal(parsed.sessionSlots.london,false)
 assert.deepEqual(parsed.sessionOpenTimes.london,{hour:15,minute:0})
 assert.equal(parsed.sessionSlots.tokyo,true)
})
test('legacy named-hour toggles migrate where meaningful', () => {
 const parsed=parseChartOverlaySettings(JSON.stringify({sessionSlots:{'07:00':false,'14:00':false,'19:30':false}}))
 assert.equal(parsed.sessionSlots.tokyo,false)
 assert.equal(parsed.sessionSlots.london,false)
 assert.equal(parsed.sessionSlots.newyork,false)
 assert.equal(parsed.sessionSlots.sydney,true)
})
