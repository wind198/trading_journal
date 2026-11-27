import type { WorkspaceAnalysis } from '../market-analysis/workspace'
import type { TradeHypothesis } from './contracts'
import type { StructuralReference, StrategyAssessment } from './strategies'
import { evaluateTrade,prepareTradeEvaluation, type TradeReview } from './evaluator'
import { SEARCH_STAGES,searchAssessments,type SearchStage,type AnchorCache } from './search-anchors'
import { distinctGeometry } from './candidate-diversity'
export { distinctGeometry } from './candidate-diversity'
import { seedCandidates,selectFinal,type SeedCandidate,type SeedId } from './candidate-search'
import { evaluateHardPolicy } from './policy'
import policy from '../../ai/trading_knowledge/config/option-policy.json' with { type: 'json' }

export interface OptionPair {
  id: string
  searchStage?:SearchStage
  seed?:SeedId
  origins?:string[]
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
export function generateTradeOptions(data:WorkspaceAnalysis,h:TradeHypothesis,onProgress?:(p:SearchProgress)=>void,clock=()=>performance.now()){
 const start=clock(),base={...h,stopLossPrice:null,takeProfitPrice:null}
 const prepared=h.entryPrice===null?undefined:prepareTradeEvaluation(data,base)
 const entryReview=evaluateTrade(data,base,prepared)
 const passed:TradeOption[]=[],failed:FailedOption[]=[]
 let attempted=0,rejected=0,unchartable=0,evaluated=0,similarSkipped=0
 let stopReason:SearchStop='SEARCH_EXHAUSTED',status:OptionStatus='entry_required'
 const stages:{stage:SearchStage;found:number;evaluated:number}[]=[]
 const context=entryReview.context
 const blocked=!context||['context_unknown','transition_uncertain'].includes(context.kind)||entryReview.warnings.some(w=>w.severity==='unassessed'||w.severity==='block')
 const pool=new Map<string,SeedCandidate>()
 const expired=()=>clock()-start>=policy.runtimeMs
 // Reserve half the budget for actual review. Check between each bounded
 // assessment/variant rather than enumerating all history pools in one call.
 const discoveryExpired=()=>clock()-start>=policy.runtimeMs*0.5
 const progress=(stage:SearchStage)=>{
  const selected=selectFinal(passed,failed)
  onProgress?.({stage,found:selected.options.length+selected.failedOptions.length,passed:selected.options.length,failed:selected.failedOptions.length,evaluated,elapsedMs:Math.round(clock()-start),target:policy.targetTotal})
 }
 if(h.entryPrice!==null&&context){
  const pools:StrategyAssessment[][]=[],anchorCache:AnchorCache=new Map()
  discovery:for(const stage of SEARCH_STAGES){
   if(discoveryExpired())break
   const before=pool.size
   progress(stage)
   const assessments=stage==='buffer_sensitivity'?pools.flat():searchAssessments(data,base,entryReview,stage,context.primary,anchorCache)
   if(stage!=='buffer_sensitivity')pools.push(assessments)
   const variants=stage==='buffer_sensitivity'?
    [...policy.stopBufferVariants.map(b=>[b,policy.targetBufferPoints] as const),...policy.targetBufferVariantsPoints.map(t=>[policy.stopBufferAtr,t] as const)]:[[policy.stopBufferAtr,policy.targetBufferPoints] as const]
   for(const [buffer,targetBuffer] of variants)for(const assessment of assessments){
    if(discoveryExpired()){stages.push({stage,found:pool.size-before,evaluated:0});break discovery}
    const r=pairReferences(base,data.snapshot.pointSize,[assessment],context.primary,buffer,stage!=='baseline',targetBuffer)
    attempted+=r.attempted;unchartable+=r.rejected-r.failedPairs.length
    for(const [list,hardPass] of [[r.pairs,true],[r.failedPairs,false]] as const)for(const raw of list){
     const origin=stage+':'+assessment.timeframe+':'+(assessment.metrics.searchLookback??'default')
     const existing=pool.get(raw.id)
     if(existing){if(!existing.origins?.includes(origin))existing.origins?.push(origin);continue}
     pool.set(raw.id,{...raw,searchStage:stage,stopBufferAtr:buffer,targetBufferPoints:targetBuffer,hardPass,seed:'primary_structure',origins:[origin]})
    }
   }
   stages.push({stage,found:pool.size-before,evaluated:0})
  }
  const queues=seedCandidates([...pool.values()])
  const visited=new Set<string>()
  let rounds=0
  // First round covers every eligible seed before checking target count.
  // Later rounds explore alternatives; final selection is global.
  while(queues.some(q=>q.queue.length)){
   for(const q of queues){
    if(expired()){stopReason='RUNTIME_LIMIT';break}
    if(evaluated>=policy.maxEvaluations){stopReason='EVALUATION_LIMIT';break}
    let raw=q.queue.shift()
    while(raw&&visited.has(raw.id))raw=q.queue.shift()
    if(!raw)continue
    visited.add(raw.id)
    const review=evaluateTrade(data,{...base,stopLossPrice:raw.stopLossPrice,takeProfitPrice:raw.takeProfitPrice},prepared)
    evaluated++
    const failureState:FailedOption['failureState']|null=review.state==='BLOCKED'?'failed_hard_policy':
     review.state==='INFEASIBLE'?'failed_structure':
     review.warnings.some(w=>w.severity==='unassessed')?'failed_data_quality':
     blocked||review.state==='INCOMPLETE'?'failed_context':null
    if(failureState){rejected++;failed.push({...raw,review,failureState})}
    else passed.push({...raw,review})
    const stage=stages.find(s=>s.stage===raw!.searchStage)
    if(stage)stage.evaluated++
   }
   rounds++
   progress('buffer_sensitivity')
   if(stopReason==='RUNTIME_LIMIT'||stopReason==='EVALUATION_LIMIT')break
   const selected=selectFinal(passed,failed)
   // Explore at least two rounds whenever queues permit, even if the first
   // round already filled the display quota.
   if(rounds>=2&&selected.options.length+selected.failedOptions.length>=policy.targetTotal&&(selected.options.length>=policy.preferredPassed||blocked)){stopReason='TARGET_REACHED';break}
  }
  const selected=selectFinal(passed,failed)
  const {options,failedOptions}=selected
  similarSkipped=[...passed,...failed].filter(c=>![...options,...failedOptions].some(s=>s.id===c.id)&&[...options,...failedOptions].some(s=>!distinctGeometry(s,c))).length
  status=options.length?'options_available':blocked?'context_unresolved':attempted?'no_feasible_option':'no_structural_pair'
  if(!options.length&&!failedOptions.length&&blocked&&stopReason==='SEARCH_EXHAUSTED')stopReason='DATA_INSUFFICIENT'
  return {snapshotId:data.snapshot.id,hypothesisId:h.id,revision:h.revision,policyVersion:policy.version,status,attempted,rejected:rejected+unchartable,unchartable,options,failedOptions,entryReview,
   search:{target:policy.targetTotal,evaluated,similarSkipped,minRelativeDifference:policy.minRelativeDifference,elapsedMs:Math.round(clock()-start),stopReason,stages,seeds:queues.map(q=>({seed:q.seed,eligible:q.eligible,remaining:q.queue.length})),uniqueGeometries:pool.size}}
 }
 if(h.entryPrice!==null){status='context_unresolved';stopReason='DATA_INSUFFICIENT'}
 return {snapshotId:data.snapshot.id,hypothesisId:h.id,revision:h.revision,policyVersion:policy.version,status,attempted,rejected,unchartable,options:passed,failedOptions:failed,entryReview,
  search:{target:policy.targetTotal,evaluated,similarSkipped,minRelativeDifference:policy.minRelativeDifference,elapsedMs:Math.round(clock()-start),stopReason,stages,seeds:[],uniqueGeometries:0}}
}
export type TradeOptions=ReturnType<typeof generateTradeOptions>
