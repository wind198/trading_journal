import type { Candle, MarketRegime } from './contracts'
import type { calculateFoundation } from './indicators'
import { ratio } from './indicators'
import { confirmedPivots, observedRange } from './structure'
import policy from '../../ai/trading_knowledge/config/regime-policy.json' with { type: 'json' }

export type RegimePolicy = typeof policy
export const EXPERIMENTAL_REGIME_POLICY: RegimePolicy = policy
type Foundation = ReturnType<typeof calculateFoundation>
const last = (s: readonly (number | null)[]) => s.at(-1) ?? null
const growth = (s: readonly (number | null)[], lag: number) => {
  const previous = s.at(-lag - 1) ?? null
  const current = last(s)
  return previous === null || current === null ? null : ratio(current - previous, previous)
}

export function inspectRange(bars: readonly Candle[], atr: number | null, p: RegimePolicy) {
  const bounds = observedRange(bars, p.windows.range)
  if (!bounds || atr === null || atr <= 0) return null
  const historical = bars.slice(-p.windows.range - 1, -1)
  const pivots = confirmedPivots(historical, p.structure.pivotLeft, p.structure.pivotRight)
  const tolerance = atr * p.structure.toleranceAtr
  const count = (side: 'high' | 'low', boundary: number) => {
    let previous = -Infinity
    let total = 0
    for (const pivot of pivots) {
      if (pivot.side !== side || Math.abs(pivot.price - boundary) > tolerance ||
        pivot.pivotIndex - previous < p.structure.minTestSeparation) continue
      total++
      previous = pivot.pivotIndex
    }
    return total
  }
  const upperTests = count('high', bounds.upper)
  const lowerTests = count('low', bounds.lower)
  const widthAtr = (bounds.upper - bounds.lower) / atr
  return { ...bounds, upperTests, lowerTests, widthAtr, tolerance,
    validated: upperTests >= p.structure.minTestsPerSide &&
      lowerTests >= p.structure.minTestsPerSide && widthAtr >= p.structure.minWidthAtr &&
      bounds.upper - bounds.lower > 2 * tolerance }
}

export function classifyRegime(bars: readonly Candle[], f: Foundation, p: RegimePolicy = EXPERIMENTAL_REGIME_POLICY, blocked = false) {
  const atr = last(f.atr), adx = last(f.dmi.adx), plus = last(f.dmi.plusDI), minus = last(f.dmi.minusDI)
  const efficiency = last(f.efficiencyRatio)
  const reg = f.regression[0]
  const slopeAtr = reg ? ratio(last(reg.slope), atr) : null
  const rSquared = reg ? last(reg.rSquared) : null
  const diSpread = plus === null || minus === null ? null : plus - minus
  const bandwidthGrowth = growth(f.bollinger.bandwidth, p.windows.transition)
  const atrGrowth = growth(f.atr, p.windows.transition)
  const range = inspectRange(bars, atr, p)
  const close = bars.at(-1)?.close
  const outside = range?.validated && close !== undefined ? close > range.upper ? 1 : close < range.lower ? -1 : 0 : null
  const metrics = { adx, efficiency, slopeAtr, rSquared, diSpread, bandwidthGrowth, atrGrowth, outside }
  const breakout = range && close !== undefined ? close > range.upper ? 1 : close < range.lower ? -1 : 0 : null
  const expanding = bandwidthGrowth !== null && atrGrowth !== null && bandwidthGrowth >= p.transition.minBandwidthGrowth && atrGrowth >= p.transition.minAtrGrowth
  const state = breakout !== null && breakout !== 0 ? 'breakout_candidate' : expanding ? 'expanding' : 'stable'
  const result = (regime: MarketRegime, reason: string) => ({ regime, reason, metrics, range, state, breakout,
    boundaryConfidence: range ? range.validated ? 'established' as const : 'provisional' as const : 'unavailable' as const,
    policyVersion: p.version, status: p.status })
  if (blocked) return result('unknown', 'stale or unavailable current data')
  if (!range || atr === null || atr <= 0 || bars.length < p.windows.range + 1 || range.upper <= range.lower)
    return result('unknown', 'insufficient price history or volatility evidence')
  // Undefined directional ratios cannot establish a trend but do not erase price boundaries.
  const directionalAvailable = adx !== null && efficiency !== null && slopeAtr !== null && rSquared !== null && diSpread !== null
  const trend = directionalAvailable && adx >= p.trend.minAdx && efficiency >= p.trend.minEfficiency &&
    Math.abs(slopeAtr) >= p.trend.minAbsSlopeAtr && rSquared >= p.trend.minRSquared &&
    Math.abs(diSpread) >= p.trend.minAbsDiSpread && Math.sign(slopeAtr) === Math.sign(diSpread)
  const ranging = directionalAvailable && !!range?.validated && outside === 0 && adx <= p.range.maxAdx &&
    efficiency <= p.range.maxEfficiency && Math.abs(slopeAtr) <= p.range.maxAbsSlopeAtr
  if (trend) return result(slopeAtr > 0 ? 'uptrend' : 'downtrend', 'directional metrics agree')
  if (ranging) return result('choppy', 'established range and weak directional metrics')
  return result('choppy', range.validated ? 'trend evidence insufficient; established historical boundaries' : 'trend evidence insufficient; provisional observed boundaries')
}
export function compareRegimes(m3: MarketRegime, m15: MarketRegime) {
  if (m3 === 'unknown' || m15 === 'unknown') return 'unknown'
  if (m3 === 'transition' || m15 === 'transition') return 'transition'
  if (m3 === m15) return 'aligned'
  if ((m3 === 'uptrend' && m15 === 'downtrend') || (m3 === 'downtrend' && m15 === 'uptrend')) return 'opposed'
  return 'mixed'
}
export function selectedTools(regime: MarketRegime): readonly string[] {
  const common = ['analyze_volatility', 'analyze_momentum', 'analyze_trend_strength']
  if (regime === 'uptrend' || regime === 'downtrend') return [...common, 'analyze_trend_extension', 'analyze_transition']
  if (regime === 'ranging' || regime === 'choppy') return [...common, 'analyze_range_position', 'analyze_range_structure', 'analyze_transition']
  return [...common, 'analyze_trend_extension', 'analyze_range_position', 'analyze_range_structure', 'analyze_transition']
}
