import assert from 'node:assert/strict'
import test from 'node:test'
import { toCreateCommandV2 } from './validate.ts'

test('maps form to schema v2 command', () => {
  const command = toCreateCommandV2('11111111-1111-4111-8111-111111111111', {
    symbol: 'EURUSD',
    side: 'BUY',
    entryPrice: '1.09500',
    triggerPrice: '1.09500',
    timeframe: '3m',
    expiresAt: '2026-11-20T17:00:00Z',
    stopLossPoints: 250,
    takeProfitPoints: 500,
    maxLossUsd: '50.00',
    forceScoreMinimum: 65,
  })
  assert.equal(command.schema_version, 2)
  assert.equal(command.risk.stop_loss_points, 250)
  assert.equal(command.filters.length, 1)
})

test('rejects non-positive risk points', () => {
  assert.throws(() =>
    toCreateCommandV2('11111111-1111-4111-8111-111111111111', {
      symbol: 'EURUSD',
      side: 'BUY',
      entryPrice: '1.09500',
      triggerPrice: '1.09500',
      timeframe: '3m',
      expiresAt: '2026-11-20T17:00:00Z',
      stopLossPoints: 0,
      takeProfitPoints: 500,
      maxLossUsd: '50.00',
    }),
  )
})