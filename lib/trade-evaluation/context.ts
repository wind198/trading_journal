import type { MarketRegime, Timeframe } from '../market-analysis/contracts'
import type { WorkspaceAnalysis } from '../market-analysis/workspace'
import type { TradeHypothesis } from './contracts'
import { confirmedPivots } from '../market-analysis/structure'
import { TIMEFRAME_SECONDS } from '../market-analysis/snapshot'
import { TRADE_RISK_POLICY as policy } from './policy'

export type StrategyId = 'continuation' | 'countertrend' | 'range' | 'transition' | 'unknown'
export function resolveStrategy(regime: MarketRegime, direction: TradeHypothesis['direction']): StrategyId {
  if(regime==='uptrend'||regime==='downtrend') return (regime==='uptrend')===(direction==='long')?'continuation':'countertrend'
  return regime==='ranging'?'range':regime==='transition'?'transition':'unknown'
}
export function makeContext(data: WorkspaceAnalysis, h: TradeHypothesis, timeframe: Timeframe) {
  const bars=data.snapshot.bars[timeframe], f=data.indicators[timeframe]
  const last=bars.at(-1)
  const stale=!last || Date.parse(data.snapshot.asOf)-Date.parse(last.closeTime)>=TIMEFRAME_SECONDS[timeframe]*1000
  const regime=stale?'unknown':data.report.regimes[timeframe]
  const atr=f.atr.at(-1)??null
  const kijun=f.ichimoku.kijun.at(-1)??null
  const sign=h.direction==='long'?1:-1
  const entry=h.entryPrice!
  const pivotBars=bars.slice(-policy.experimental.pivotLookback)
  const pivots=confirmedPivots(pivotBars,data.report.policy.structure.pivotLeft,data.report.policy.structure.pivotRight)
  // Historical pivot candidates are not certified trend roots or active zones.
  const lossSide=pivots.filter(p=>p.side===(sign===1?'low':'high')&&(entry-p.price)*sign>0)
  const profitSide=pivots.filter(p=>p.side===(sign===1?'high':'low')&&(p.price-entry)*sign>0)
  const stopPivot=[...lossSide].sort((a,b)=>Math.abs(a.price-entry)-Math.abs(b.price-entry))[0]??null
  const targetPivot=[...profitSide].sort((a,b)=>Math.abs(a.price-entry)-Math.abs(b.price-entry))[0]??null
  const momentum=data.report.results.find(r=>r.timeframe===timeframe&&r.toolId==='analyze_momentum')
  const pressure=momentum?.features.pressure?.value??null
  const evidenceIds=data.report.results.filter(r=>r.timeframe===timeframe).flatMap(r=>r.evidence.map(e=>e.id))
  return {h,timeframe,regime,strategy:resolveStrategy(regime,h.direction),entry,sign,atr,kijun,pressure,stale,
    range:data.report.classifications[timeframe].range,stopPivot,targetPivot,evidenceIds,pointSize:data.snapshot.pointSize,
    from:pivotBars[0]?.closeTime??null,through:last?.closeTime??null}
}
export type EvaluationContext = ReturnType<typeof makeContext>
