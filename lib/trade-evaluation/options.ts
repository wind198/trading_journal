import type { WorkspaceAnalysis } from '../market-analysis/workspace'
import type { TradeHypothesis } from './contracts'
import type { StructuralReference, StrategyAssessment } from './strategies'
import { evaluateTrade, type TradeReview } from './evaluator'
import { evaluateHardPolicy } from './policy'
import policy from '../../ai/trading_knowledge/config/option-policy.json' with { type: 'json' }

export interface OptionPair {
  id: string
  stopLossPrice: number
  takeProfitPrice: number
  stopReference: StructuralReference
  targetReference: StructuralReference
  riskPoints: number
  rewardPoints: number
  grossRewardRisk: number
}
export interface TradeOption extends OptionPair {
  review: TradeReview
}
type OptionStatus = 'entry_required' | 'context_unresolved' | 'no_structural_pair' | 'no_feasible_option' | 'options_available'

const rangeBoundary=(source:StructuralReference['source'])=>source==='validated range boundary'||source==='provisional range boundary'
const structuralStop = new Set<StructuralReference['source']>(['active zone outer edge','correction root candidate','validated range boundary','provisional range boundary'])
const structuralTarget = new Set<StructuralReference['source']>(['active zone near edge','validated range boundary','provisional range boundary','confirmed pivot','equilibrium'])
// Snap outwards for SL and inwards for TP, never toward the wrong side.
function snap(value:number,point:number,up:boolean){
  const units=value/point
  return Number(((up?Math.ceil(units-1e-7):Math.floor(units+1e-7))*point).toPrecision(15))
}
export function pairReferences(h:TradeHypothesis,point:number,assessments:readonly StrategyAssessment[],primary:NonNullable<TradeReview['context']>['primary']){
  const pairs:OptionPair[]=[]
  let rejected=0,attempted=0
  if(h.entryPrice===null||!Number.isFinite(h.entryPrice)||h.entryPrice<=0||!Number.isFinite(point)||point<=0)return {pairs,rejected,attempted}
  const long=h.direction==='long'
  const seen=new Set<string>()
  // Pair within a single coherent timeframe and strategy. A local countertrend
  // must not provide continuation exits for an opposing primary hypothesis.
  for(const a of assessments){
    if(a.strategy!==primary&&!(primary==='continuation'&&a.strategy==='correction_entry'))continue
    if(primary==='unknown'||primary==='transition')continue
    const atr=a.metrics.atr
    if(atr===null||!Number.isFinite(atr)||atr<=0)continue
    const refs=a.references.filter(r=>r.timeframe===a.timeframe&&Number.isFinite(r.price)&&r.price>0&&r.evidenceIds.length>0)
    const stops=refs.filter(r=>structuralStop.has(r.source)&&r.kind==='stop'&&(primary==='range'?rangeBoundary(r.source):!rangeBoundary(r.source)))
    const targets=refs.filter(r=>structuralTarget.has(r.source)&&r.kind==='target'&&(primary==='range'?rangeBoundary(r.source):!rangeBoundary(r.source)&&(r.source!=='equilibrium'||primary==='countertrend')))
    // In a validated range, never reach beyond its opposite boundary. Other
    // strategies may cross an obstacle, but the full review must disclose it.
    for(const s of stops)for(const t of targets){
      // Never mix inner stop and outer target to manufacture reward/risk.
      if(primary==='range'&&(s.rangeId??'outer')!==(t.rangeId??'outer'))continue
      attempted++
      const buffer=Math.max(point,atr*policy.stopBufferAtr)
      const sl=snap(s.price+(long?-buffer:buffer),point,!long)
      const tp=snap(t.price+(long?-1:1)*policy.targetBufferPoints*point,point,!long)
      const hard=evaluateHardPolicy({...h,stopLossPrice:sl,takeProfitPrice:tp},point)
      const g=hard.geometry
      if(g.mode!=='complete'||g.riskPoints===null||g.rewardPoints===null||g.grossRewardRisk===null||hard.warnings.some(w=>w.severity==='block')){rejected++;continue}
      const id=sl.toFixed(5)+':'+tp.toFixed(5)
      if(seen.has(id))continue
      seen.add(id)
      pairs.push({id,stopLossPrice:sl,takeProfitPrice:tp,stopReference:s,targetReference:t,riskPoints:g.riskPoints,rewardPoints:g.rewardPoints,grossRewardRisk:g.grossRewardRisk})
    }
  }
  // Stable enumeration, not probability ranking: narrower risk first, then
  // shorter target distance. Never label any option as recommended or safe.
  pairs.sort((a,b)=>a.riskPoints-b.riskPoints||a.rewardPoints-b.rewardPoints||a.id.localeCompare(b.id))
  return {pairs,rejected,attempted}
}
export function generateTradeOptions(data:WorkspaceAnalysis,h:TradeHypothesis){
  const base={...h,stopLossPrice:null,takeProfitPrice:null}
  const entryReview=evaluateTrade(data,base)
  const options:TradeOption[]=[]
  let status:OptionStatus='entry_required',attempted=0,rejected=0
  if(h.entryPrice!==null){
    const context=entryReview.context
    if(!context||['context_unknown','transition_uncertain'].includes(context.kind)||entryReview.warnings.some(w=>w.severity==='unassessed'||w.severity==='block')){
      status='context_unresolved'
    }else{
      const result=pairReferences(base,data.snapshot.pointSize,entryReview.assessments,context.primary)
      attempted=result.attempted;rejected=result.rejected
      for(const pair of result.pairs){
        const review=evaluateTrade(data,{...base,stopLossPrice:pair.stopLossPrice,takeProfitPrice:pair.takeProfitPrice})
        if(review.state==='BLOCKED'||review.state==='INFEASIBLE'||review.state==='INCOMPLETE'){rejected++;continue}
        options.push({...pair,review})
        if(options.length>=policy.maxOptions)break
      }
      status=options.length?'options_available':attempted?'no_feasible_option':'no_structural_pair'
    }
  }
  return {snapshotId:data.snapshot.id,hypothesisId:h.id,revision:h.revision,policyVersion:policy.version,status,attempted,rejected,options,entryReview}
}
export type TradeOptions=ReturnType<typeof generateTradeOptions>
