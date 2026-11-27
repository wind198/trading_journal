import type { WorkspaceAnalysis } from '../market-analysis/workspace'
import type { TradeHypothesis } from './contracts'
import type { StructuralReference, StrategyAssessment } from './strategies'
import { evaluateTrade, type TradeReview } from './evaluator'
import { SEARCH_STAGES,searchAssessments,type SearchStage } from './search-anchors'
import { evaluateHardPolicy } from './policy'
import policy from '../../ai/trading_knowledge/config/option-policy.json' with { type: 'json' }

export interface OptionPair {
  id: string
  searchStage?:SearchStage
  stopBufferAtr?:number
  targetBufferPoints?:number
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
export type FailedOption = TradeOption & {failureState:'failed_hard_policy'|'failed_structure'|'failed_context'|'failed_data_quality'}
type OptionStatus = 'entry_required' | 'context_unresolved' | 'no_structural_pair' | 'no_feasible_option' | 'options_available'

const rangeBoundary=(source:StructuralReference['source'])=>source==='validated range boundary'||source==='provisional range boundary'
const structuralStop = new Set<StructuralReference['source']>(['active zone outer edge','correction root candidate','validated range boundary','provisional range boundary'])
const structuralTarget = new Set<StructuralReference['source']>(['active zone near edge','validated range boundary','provisional range boundary','confirmed pivot','equilibrium'])
// Snap outwards for SL and inwards for TP, never toward the wrong side.
function snap(value:number,point:number,up:boolean){
  const units=value/point
  return Number(((up?Math.ceil(units-1e-7):Math.floor(units+1e-7))*point).toPrecision(15))
}
export function pairReferences(h:TradeHypothesis,point:number,assessments:readonly StrategyAssessment[],primary:NonNullable<TradeReview['context']>['primary'],bufferAtr=policy.stopBufferAtr,expanded=false,targetBufferPoints=policy.targetBufferPoints){
  const pairs:OptionPair[]=[],failedPairs:OptionPair[]=[]
  let rejected=0,attempted=0
  if(h.entryPrice===null||!Number.isFinite(h.entryPrice)||h.entryPrice<=0||!Number.isFinite(point)||point<=0)return {pairs,failedPairs,rejected,attempted}
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
    const stops=refs.filter(r=>(structuralStop.has(r.source)||(expanded&&r.source==='confirmed pivot'))&&r.kind==='stop'&&(primary==='range'?rangeBoundary(r.source)||(expanded&&(r.source==='active zone outer edge'||r.source==='confirmed pivot')):!rangeBoundary(r.source)))
    const targets=refs.filter(r=>structuralTarget.has(r.source)&&r.kind==='target'&&(primary==='range'?rangeBoundary(r.source)||(expanded&&(r.source==='active zone near edge'||r.source==='confirmed pivot')):!rangeBoundary(r.source)&&(r.source!=='equilibrium'||primary==='countertrend')))
    // In a validated range, never reach beyond its opposite boundary. Other
    // strategies may cross an obstacle, but the full review must disclose it.
    for(const s of stops)for(const t of targets){
      // Never mix inner stop and outer target to manufacture reward/risk.
      if(primary==='range'&&(rangeBoundary(s.source)!==rangeBoundary(t.source)||(s.rangeId??'outer')!==(t.rangeId??'outer')||(s.source==='confirmed pivot')!==(t.source==='confirmed pivot')))continue
      if((s.scale??'baseline')!==(t.scale??'baseline'))continue
      attempted++
      const buffer=Math.max(point,atr*bufferAtr)
      const sl=snap(s.price+(long?-buffer:buffer),point,!long)
      const tp=snap(t.price+(long?-1:1)*targetBufferPoints*point,point,!long)
      const hard=evaluateHardPolicy({...h,stopLossPrice:sl,takeProfitPrice:tp},point)
      const g=hard.geometry
      if(g.mode!=='complete'||g.riskPoints===null||g.rewardPoints===null||g.grossRewardRisk===null){rejected++;continue}
      const id=sl.toFixed(5)+':'+tp.toFixed(5)
      if(seen.has(id))continue
      seen.add(id)
      const destination=hard.warnings.some(w=>w.severity==='block')?failedPairs:pairs
      if(destination===failedPairs)rejected++
      destination.push({id,stopLossPrice:sl,takeProfitPrice:tp,stopReference:s,targetReference:t,riskPoints:g.riskPoints,rewardPoints:g.rewardPoints,grossRewardRisk:g.grossRewardRisk})
    }
  }
  // Stable enumeration, not probability ranking: narrower risk first, then
  // shorter target distance. Never label any option as recommended or safe.
  pairs.sort((a,b)=>a.riskPoints-b.riskPoints||a.rewardPoints-b.rewardPoints||a.id.localeCompare(b.id))
  return {pairs,failedPairs,rejected,attempted}
}
export type SearchStop='TARGET_REACHED'|'RUNTIME_LIMIT'|'EVALUATION_LIMIT'|'SEARCH_EXHAUSTED'|'DATA_INSUFFICIENT'
export interface SearchProgress{stage:SearchStage;found:number;passed:number;failed:number;evaluated:number;elapsedMs:number;target:number}
/** Order-independent relative distance; the larger distance must be at least 1.2x the smaller. */
export function distinctGeometry(a:OptionPair,b:OptionPair){
 const different=(x:number,y:number)=>Number.isFinite(x)&&Number.isFinite(y)&&x>0&&y>0&&Math.max(x,y)-Math.min(x,y)>=Math.min(x,y)*policy.minRelativeDifference-1e-9
 return different(a.riskPoints,b.riskPoints)||different(a.rewardPoints,b.rewardPoints)
}
export function generateTradeOptions(data:WorkspaceAnalysis,h:TradeHypothesis,onProgress?:(p:SearchProgress)=>void,clock=()=>performance.now()){
 const start=clock(),base={...h,stopLossPrice:null,takeProfitPrice:null}
 const entryReview=evaluateTrade(data,base)
 const options:TradeOption[]=[],failedOptions:FailedOption[]=[]
 const retained:OptionPair[]=[],attemptedIds=new Set<string>()
 let attempted=0,rejected=0,unchartable=0,evaluated=0,similarSkipped=0
 const targetPassed=2 // Prefer useful passing alternatives without weakening any gate.
 let stopReason:SearchStop='SEARCH_EXHAUSTED'
 let status:OptionStatus='entry_required'
 const stages:{stage:SearchStage;found:number;evaluated:number}[]=[]
 const context=entryReview.context
 const blocked=!context||['context_unknown','transition_uncertain'].includes(context.kind)||entryReview.warnings.some(w=>w.severity==='unassessed'||w.severity==='block')
 const progress=(stage:SearchStage)=>onProgress?.({stage,found:retained.length,passed:options.length,failed:failedOptions.length,evaluated,elapsedMs:Math.round(clock()-start),target:policy.targetTotal})
 const budget=():SearchStop|null=>retained.length>=policy.targetTotal&&(options.length>=targetPassed||blocked)?'TARGET_REACHED':clock()-start>=policy.runtimeMs?'RUNTIME_LIMIT':evaluated>=policy.maxEvaluations?'EVALUATION_LIMIT':null
 if(h.entryPrice!==null&&context){
  const pools:StrategyAssessment[][]=[]
  outer:for(const stage of SEARCH_STAGES){
   const before=retained.length,evBefore=evaluated
   const limit=budget();if(limit){stopReason=limit;break}
   progress(stage)
   const assessments=stage==='buffer_sensitivity'?pools.flat():searchAssessments(data,base,entryReview,stage,context.primary)
   if(stage!=='buffer_sensitivity')pools.push(assessments)
   const buffers=stage==='buffer_sensitivity'?policy.stopBufferVariants:[policy.stopBufferAtr]
   const targets=stage==='buffer_sensitivity'?[policy.targetBufferPoints,...policy.targetBufferVariantsPoints]:[policy.targetBufferPoints]
   for(const buffer of buffers)for(const targetBuffer of targets){
    const preLimit=budget();if(preLimit){stopReason=preLimit;stages.push({stage,found:retained.length-before,evaluated:evaluated-evBefore});break outer}
    const result=pairReferences(base,data.snapshot.pointSize,assessments,context.primary,buffer,stage!=='baseline',targetBuffer)
    attempted+=result.attempted
    unchartable+=result.rejected-result.failedPairs.length
    // Interleave hard-pass and hard-fail candidates rather than consuming the
    // whole budget on one outcome. Prefer distinct anchor pairs before buffers.
    const candidates:OptionPair[]=[]
    for(let i=0;i<Math.max(result.pairs.length,result.failedPairs.length);i++){
     if(result.pairs[i])candidates.push(result.pairs[i])
     if(result.failedPairs[i])candidates.push(result.failedPairs[i])
    }
    for(const raw of candidates){
     const limit=budget()
     if(limit){stopReason=limit;stages.push({stage,found:retained.length-before,evaluated:evaluated-evBefore});break outer}
     if(attemptedIds.has(raw.id))continue
     attemptedIds.add(raw.id)
     const conflicts=retained.filter(p=>!distinctGeometry(p,raw))
     const hardPass=!evaluateHardPolicy({...base,stopLossPrice:raw.stopLossPrice,takeProfitPrice:raw.takeProfitPrice},data.snapshot.pointSize).warnings.some(w=>w.severity==='block')
     if(conflicts.some(p=>options.some(o=>o.id===p.id))||((conflicts.length>0||retained.length>=policy.targetTotal)&&(!hardPass||blocked))){similarSkipped++;continue}
     const pair={...raw,searchStage:stage,stopBufferAtr:buffer,targetBufferPoints:targetBuffer}
     const review=evaluateTrade(data,{...base,stopLossPrice:pair.stopLossPrice,takeProfitPrice:pair.takeProfitPrice})
     evaluated++
     const failureState:FailedOption['failureState']|null=review.state==='BLOCKED'?'failed_hard_policy':
      review.state==='INFEASIBLE'?'failed_structure':
      review.warnings.some(w=>w.severity==='unassessed')?'failed_data_quality':
      blocked||review.state==='INCOMPLETE'?'failed_context':null
     if(failureState&&(conflicts.length||retained.length>=policy.targetTotal)){rejected++;continue}
     if(!failureState){
      // A passing geometry may replace a similar failed example; no retained
      // pair may violate diversity, including across the two outcome groups.
      const evict=new Set(conflicts.map(p=>p.id))
      if(!evict.size&&retained.length>=policy.targetTotal&&failedOptions.length)evict.add(failedOptions[failedOptions.length-1].id)
      for(let i=retained.length-1;i>=0;i--)if(evict.has(retained[i].id))retained.splice(i,1)
      for(let i=failedOptions.length-1;i>=0;i--)if(evict.has(failedOptions[i].id))failedOptions.splice(i,1)
     }
     if(retained.length>=policy.targetTotal)continue
     retained.push(pair)
     if(failureState){rejected++;failedOptions.push({...pair,review,failureState})}
     else options.push({...pair,review})
     progress(stage)
    }
   }
   stages.push({stage,found:retained.length-before,evaluated:evaluated-evBefore})
   const limitAfter=budget();if(limitAfter){stopReason=limitAfter;break}
  }
  status=options.length?'options_available':blocked?'context_unresolved':attempted?'no_feasible_option':'no_structural_pair'
  if(!retained.length&&blocked&&stopReason==='SEARCH_EXHAUSTED')stopReason='DATA_INSUFFICIENT'
 }else if(h.entryPrice!==null){status='context_unresolved';stopReason='DATA_INSUFFICIENT'}
 return {snapshotId:data.snapshot.id,hypothesisId:h.id,revision:h.revision,policyVersion:policy.version,status,attempted,rejected:rejected+unchartable,unchartable,options,failedOptions,entryReview,
  search:{target:policy.targetTotal,evaluated,similarSkipped,minRelativeDifference:policy.minRelativeDifference,elapsedMs:Math.round(clock()-start),stopReason,stages}}
}
export type TradeOptions=ReturnType<typeof generateTradeOptions>
