export type OrderSide = 'BUY' | 'SELL'
export type Timeframe = '3m' | '15m' | '1h' | '4h'

export type AckResult =
  | 'ARMED'
  | 'REJECTED'
  | 'WAREHOUSE_OFFLINE'
  | 'UNKNOWN_OUTCOME'
  | 'CANCELLED'

export type ConditionalOrderInput = {
  deviceId?: string
  accountId?: string
  symbol: string
  side: OrderSide
  entryPrice: string
  triggerPrice: string
  timeframe: Timeframe
  expiresAt: string
  stopLossPoints: number
  takeProfitPoints: number
  maxLossUsd: string
  forceScoreMinimum?: number
  engulfingMinimumScore?: number
  maxDeviationPoints?: number
  comment?: string
}

export type ConditionalOrderResponse = {
  orderId: string
  result: AckResult
  state?: string
  reason?: string | null
  calculatedVolumeLots?: string | null
  persistenceLagSeconds?: number | null
}