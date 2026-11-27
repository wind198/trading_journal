import type { Timeframe } from '../market-analysis/contracts'

export type TradeDirection = 'long' | 'short'
export type TradeLevel = 'entryPrice' | 'stopLossPrice' | 'takeProfitPrice'
export interface TradeHypothesis {
  readonly id: string
  readonly snapshotId: string
  readonly symbol: 'EURUSD'
  readonly direction: TradeDirection
  readonly entryPrice: number | null
  readonly stopLossPrice: number | null
  readonly takeProfitPrice: number | null
  readonly maxLossUsd: number | null
  readonly entryTimeframe: Timeframe
  readonly revision: number
}
export type ReviewMode = 'incomplete' | 'exploratory' | 'complete' | 'invalid'
