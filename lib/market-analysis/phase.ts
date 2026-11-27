import type { MarketRegime, Timeframe } from './contracts'
import type { WorkspaceAnalysis } from './workspace'
import { TIMEFRAME_SECONDS } from './snapshot'
import policy from '../../ai/trading_knowledge/config/phase-policy.json' with { type: 'json' }

export type MarketPhase = 'expansion' | 'correction_candidate' | 'consolidation' | 'exhaustion_candidate' | 'transition' | 'choppy' | 'unresolved' | 'unknown'
export interface PhaseMetrics {
  displacementAtr: number | null
  kijunExtensionAtr: number | null
  adxChange: number | null
  efficiency: number | null
}
export interface PhaseObservation {
  timeframe: Timeframe
  regime: MarketRegime
  phase: MarketPhase
  reason: string
  metrics: PhaseMetrics
  evidenceIds: readonly string[]
  from: string | null
  through: string | null
  policyVersion: string
}
export function classifyPhase(regime: MarketRegime, metrics: PhaseMetrics): {phase: MarketPhase;reason:string} {
  const {displacementAtr:d,kijunExtensionAtr:k,adxChange:a,efficiency:e}=metrics
  if(regime==='unknown')return {phase:'unknown',reason:'Market regime unavailable or uncertain.'}
  if(regime==='transition')return {phase:'transition',reason:'Regime transition detected; structural change is not confirmed.'}
  if(regime==='choppy'||regime==='ranging')return {phase:'choppy',reason:'Non-trending market; boundary evidence evaluated independently.'}
  if(d===null||e===null)return {phase:'unknown',reason:'Insufficient displacement or efficiency evidence.'}
  const sign=regime==='uptrend'?1:-1
  if(d*sign<=-policy.minCorrectionAtr)return {phase:'correction_candidate',reason:'Recent displacement opposes the detected trend; root and completion unconfirmed.'}
  if(k!==null&&a!==null&&k*sign>=policy.minExhaustionExtensionAtr&&a<=-policy.minAdxDecay&&Math.abs(d)<=policy.maxExhaustionDisplacementAtr)
    return {phase:'exhaustion_candidate',reason:'Extended price, declining ADX and slowing displacement; reversal not confirmed.'}
  if(Math.abs(d)<=policy.maxConsolidationAtr&&e<=policy.maxConsolidationEfficiency)
    return {phase:'consolidation',reason:'Low recent displacement and low directional efficiency.'}
  if(d*sign>=policy.minExpansionAtr)return {phase:'expansion',reason:'Recent displacement agrees with the detected trend.'}
  return {phase:'unresolved',reason:'No experimental phase rule has sufficient support.'}
}
export function observePhase(data:WorkspaceAnalysis,timeframe:Timeframe):PhaseObservation {
  const bars=data.snapshot.bars[timeframe],f=data.indicators[timeframe],n=policy.lookbackBars
  const latest=bars.at(-1),prior=bars.at(-n-1)
  const fresh=!!latest&&Date.parse(data.snapshot.asOf)-Date.parse(latest.closeTime)<TIMEFRAME_SECONDS[timeframe]*1000
  const contiguous=!!prior&&!!latest&&bars.slice(-n-1).every((b,i,window)=>i===0||Date.parse(b.closeTime)-Date.parse(window[i-1].closeTime)===TIMEFRAME_SECONDS[timeframe]*1000)
  const atr=f.atr.at(-1),kijun=f.ichimoku.kijun.at(-1),adx=f.dmi.adx.at(-1),oldAdx=f.dmi.adx.at(-n-1)
  const valid=fresh&&contiguous&&atr!=null&&atr>0
  const metrics:PhaseMetrics={displacementAtr:valid&&latest&&prior?(latest.close-prior.close)/atr:null,
    kijunExtensionAtr:valid&&latest&&kijun!=null?(latest.close-kijun)/atr:null,
    adxChange:valid&&adx!=null&&oldAdx!=null?adx-oldAdx:null,
    efficiency:valid?f.efficiencyRatio.at(-1)??null:null}
  const regime=data.report.regimes[timeframe]
  const observation=valid&&data.report.classifications[timeframe].dataQuality!=='recent_gap'?(regime!=='unknown'&&(data.report.classifications[timeframe].state==='breakout_candidate'||data.report.classifications[timeframe].state==='expanding')?{phase:'transition' as const,reason:'Breakout candidate or volatility expansion; underlying regime retained.'}:classifyPhase(regime,metrics)):{phase:'unknown' as const,reason:'Stale, missing or discontinuous recent data.'}
  return {timeframe,regime,...observation,metrics,policyVersion:policy.version,
    evidenceIds:data.report.results.filter(r=>r.timeframe===timeframe&&['classify_market_regime','analyze_trend_strength','analyze_volatility','analyze_trend_extension'].includes(r.toolId)).flatMap(r=>r.evidence.map(e=>e.id)),
    from:prior?.closeTime??null,through:latest?.closeTime??null}
}
