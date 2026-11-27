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
  const result = (regime: MarketRegime, reason: string) => ({ regime, reason, metrics, range, policyVersion: p.version, status: p.status })
  if (blocked) return result('unknown', 'stale or unavailable current data')
  if (adx === null || efficiency === null || slopeAtr === null || rSquared === null || diSpread === null ||
      bandwidthGrowth === null || atrGrowth === null) return result('unknown', 'insufficient numerical evidence')
  if (outside !== null && outside !== 0) return result('transition', 'close outside validated historical range')
  if (bandwidthGrowth >= p.transition.minBandwidthGrowth && atrGrowth >= p.transition.minAtrGrowth)
    return result('transition', 'concurrent volatility and dispersion expansion')
  const trend = adx >= p.trend.minAdx && efficiency >= p.trend.minEfficiency &&
    Math.abs(slopeAtr) >= p.trend.minAbsSlopeAtr && rSquared >= p.trend.minRSquared &&
    Math.abs(diSpread) >= p.trend.minAbsDiSpread && Math.sign(slopeAtr) === Math.sign(diSpread)
  const ranging = !!range?.validated && outside === 0 && adx <= p.range.maxAdx &&
    efficiency <= p.range.maxEfficiency && Math.abs(slopeAtr) <= p.range.maxAbsSlopeAtr
  if (trend) return result(slopeAtr > 0 ? 'uptrend' : 'downtrend', 'directional metrics agree')
  if (ranging) return result('ranging', 'bounded structure and weak directional metrics agree')
  return result('unknown', 'mixed evidence; no regime asserted')
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
  if (regime === 'uptrend' || regime === 'downtrend') return [...common, 'analyze_trend_extension']
  if (regime === 'ranging') return [...common, 'analyze_range_position', 'analyze_range_structure']
  return [...common, 'analyze_trend_extension', 'analyze_range_position', 'analyze_range_structure', 'analyze_transition']
}
