import type { Timeframe } from '../market-analysis/contracts'
import type { TradeDirection, TradeHypothesis, TradeLevel, ReviewMode } from './contracts'

export function normalizePrice(value: number, pointSize: number): number | null {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(pointSize) || pointSize <= 0) return null
  const points = Math.round(value / pointSize)
  if (!Number.isSafeInteger(points) || points <= 0) return null
  return Number((points * pointSize).toPrecision(15))
}
export function createHypothesis(id: string, snapshotId: string, direction: TradeDirection = 'long'): TradeHypothesis {
  return { id, snapshotId, symbol: 'EURUSD', direction, entryPrice: null, stopLossPrice: null,
    takeProfitPrice: null, maxLossUsd: null, entryTimeframe: 'M3', revision: 0 }
}
export function setTradeLevel(h: TradeHypothesis, level: TradeLevel, value: number | null, pointSize: number, timeframe?: Timeframe): TradeHypothesis {
  const price = value === null ? null : normalizePrice(value, pointSize)
  if (value !== null && price === null) return h
  const entryTimeframe = level === 'entryPrice' && timeframe ? timeframe : h.entryTimeframe
  if (h[level] === price && h.entryTimeframe === entryTimeframe) return h
  return { ...h, [level]: price, entryTimeframe, revision: h.revision + 1 }
}
export function setTradeDirection(h: TradeHypothesis, direction: TradeDirection): TradeHypothesis {
  if (h.direction === direction) return h
  // Never silently mirror or invent prices when changing direction.
  return { ...h, direction, revision: h.revision + 1 }
}
export function rebindSnapshot(h: TradeHypothesis, snapshotId: string): TradeHypothesis {
  return h.snapshotId === snapshotId ? h : { ...h, snapshotId, revision: h.revision + 1 }
}
export function evaluateGeometry(h: TradeHypothesis, pointSize: number) {
  const errors: string[] = []
  const { entryPrice: entry, stopLossPrice: stop, takeProfitPrice: target } = h
  const validPrice = (v: number | null) => v === null || (Number.isFinite(v) && v > 0)
  if (![entry, stop, target].every(validPrice) || !(pointSize > 0) || !Number.isFinite(pointSize)) errors.push('Invalid price or point size.')
  const sign = h.direction === 'long' ? 1 : -1
  const points = (value: number) => Math.round(value / pointSize)
  const riskPoints = entry !== null && stop !== null && !errors.length ? points((entry - stop) * sign) : null
  const rewardPoints = entry !== null && target !== null && !errors.length ? points((target - entry) * sign) : null
  if (riskPoints !== null && riskPoints <= 0) errors.push('SL must be on the loss side of entry.')
  if (rewardPoints !== null && rewardPoints <= 0) errors.push('TP must be on the profit side of entry.')
  const mode: ReviewMode = errors.length ? 'invalid' : entry === null ? 'incomplete' : stop === null || target === null ? 'exploratory' : 'complete'
  return { mode, errors, riskPoints: riskPoints !== null && riskPoints > 0 ? riskPoints : null,
    rewardPoints: rewardPoints !== null && rewardPoints > 0 ? rewardPoints : null,
    grossRewardRisk: mode === 'complete' && riskPoints && rewardPoints ? rewardPoints / riskPoints : null }
}
