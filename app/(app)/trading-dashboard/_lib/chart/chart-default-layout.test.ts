import assert from 'node:assert/strict'
import { test } from 'node:test'
import { defaultChartLayout } from './chart-default-layout'

test('default chart layout shows the latest 100 bars with symmetric price padding', () => {
  assert.deepEqual(defaultChartLayout(250), {
    logicalRange: { from: 150, to: 249 },
    scaleMargins: { top: 0.1, bottom: 0.1 },
  })
})

test('default chart layout fits all bars when history is shorter than 100', () => {
  assert.deepEqual(defaultChartLayout(42).logicalRange, { from: 0, to: 41 })
})
