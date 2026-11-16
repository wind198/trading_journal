import assert from 'node:assert/strict'
import test from 'node:test'
import { PriceChartInteractionMediator, type PriceChartInteractionHandlers } from './price-chart-interaction-mediator'
import type { ChartHandle } from './price-chart-handle'

test('mediator registers one listener set and removes chart subscriptions on dispose', () => {
  const calls: string[] = []
  const chart = {
    subscribeClick: () => calls.push('subscribeClick'),
    unsubscribeClick: () => calls.push('unsubscribeClick'),
    subscribeCrosshairMove: () => calls.push('subscribeCrosshairMove'),
    unsubscribeCrosshairMove: () => calls.push('unsubscribeCrosshairMove'),
  } as unknown as ChartHandle['chart']
  const element = {
    addEventListener: (name: string) => calls.push(`add:${name}`),
    removeEventListener: (name: string) => calls.push(`remove:${name}`),
  } as unknown as HTMLElement
  const noop = () => {}
  const handlers: PriceChartInteractionHandlers = {
    chartClick: noop, crosshairMove: noop,
    chartPointerDown: noop, chartPointerMove: noop, chartPointerUp: noop,
    chartPointerCancel: noop, chartDoubleClick: noop,
    overlayPointerDown: noop, overlayPointerMove: noop, overlayPointerUp: noop,
    overlayPointerCancel: noop,
  }
  const mediator = new PriceChartInteractionMediator(chart, element, element, handlers)
  mediator.start()
  mediator.start()
  assert.equal(calls.filter((call) => call === 'subscribeClick').length, 1)
  assert.equal(calls.filter((call) => call === 'add:pointerdown').length, 2)
  mediator.dispose()
  mediator.dispose()
  assert.equal(calls.filter((call) => call === 'unsubscribeClick').length, 1)
  assert.equal(calls.filter((call) => call === 'unsubscribeCrosshairMove').length, 1)
  assert.equal(calls.filter((call) => call === 'remove:pointerdown').length, 2)
})
