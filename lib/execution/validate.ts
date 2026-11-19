import type { ConditionalOrderCreateV2 } from '@/contracts/generated/typescript'
import type { ConditionalOrderInput, Timeframe } from '@/lib/execution/types'

const TIMEFRAMES = new Set<Timeframe>(['3m', '15m', '1h', '4h'])

export function toCreateCommandV2(
  orderId: string,
  input: ConditionalOrderInput,
): ConditionalOrderCreateV2 {
  if (!TIMEFRAMES.has(input.timeframe)) throw new Error('Invalid timeframe')
  if (input.stopLossPoints <= 0 || input.takeProfitPoints <= 0) {
    throw new Error('SL/TP points must be positive')
  }
  const maxLoss = Number(input.maxLossUsd)
  if (!Number.isFinite(maxLoss) || maxLoss <= 0) throw new Error('Invalid max loss')

  const filters: Array<Record<string, unknown>> = []
  if (input.forceScoreMinimum != null) {
    filters.push({
      type: 'force_score',
      minimum: input.forceScoreMinimum,
      direction: 'same_as_order',
    })
  }
  if (input.engulfingMinimumScore != null) {
    filters.push({
      type: 'pattern',
      name: 'engulfing',
      direction: 'same_as_order',
      minimum_score: input.engulfingMinimumScore,
    })
  }

  return {
    schema_version: 2 as const,
    order_id: orderId,
    device_id: input.deviceId ?? 'home-mt5',
    account_id: input.accountId ?? 'primary',
    symbol: input.symbol,
    side: input.side,
    entry_price: input.entryPrice,
    timeframe: input.timeframe,
    trigger: { type: 'candle_close_cross' as const, price: input.triggerPrice },
    filters,
    risk: {
      stop_loss_points: input.stopLossPoints,
      take_profit_points: input.takeProfitPoints,
      max_loss_usd: input.maxLossUsd,
    },
    execution: {
      max_deviation_points: input.maxDeviationPoints ?? 20,
      comment: input.comment ?? 'journal-close-stop',
    },
    expires_at: input.expiresAt,
  }
}