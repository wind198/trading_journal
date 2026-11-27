import type { WorkspaceAnalysis } from '../market-analysis/workspace'
import type { TradeHypothesis } from './contracts'
import type { StrategyAssessment,StructuralReference } from './strategies'
import type { TradeReview } from './evaluator'
import { inspectActiveStructure } from '../market-analysis/active-structure'
import { inspectRange,EXPERIMENTAL_REGIME_POLICY } from '../market-analysis/regimes'
import { TIMEFRAME_SECONDS } from '../market-analysis/snapshot'
import { confirmedPivots,type ConfirmedPivot } from '../market-analysis/structure'
import policy from '../../ai/trading_knowledge/config/option-policy.json' with {type:'json'}

export const SEARCH_STAGES=['baseline','extended','structural','alternative_anchors','deep_history','buffer_sensitivity'] as const
export type SearchStage=typeof SEARCH_STAGES[number]
type Primary=NonNullable<TradeReview['context']>['primary']
export type AnchorCache=Map<string,ConfirmedPivot[]>
export function searchAssessments(data:WorkspaceAnalysis,h:TradeHypothesis,review:TradeReview,stage:SearchStage,primary:Primary,cache:AnchorCache=new Map()):StrategyAssessment[]{
 if(stage==='baseline')return review.assessments
 if(h.entryPrice===null||primary==='unknown'||primary==='transition')return []
 const entry=h.entryPrice,sign=h.direction==='long'?1:-1
 const out:StrategyAssessment[]=[]
 for(const a of review.assessments){
  if(a.strategy!==primary&&!(primary==='continuation'&&a.strategy==='correction_entry'))continue
  const tf=a.timeframe
  if(data.report.classifications[tf].dataQuality!=='usable')continue
  const scale=stage==='extended'||stage==='structural'?stage:'baseline'
  const larger=scale==='baseline'?null:data.report.scales[tf][scale]
  if(larger&&larger.quality!=='usable')continue
  const f=scale==='baseline'?data.indicators[tf]:data.scaleIndicators[tf][scale]
  const atr=f.atr.at(-1)??null
  if(atr===null||atr<=0)continue
  const evidenceIds=data.report.results.filter(r=>r.timeframe===tf&&(larger?r.toolId==='analyze_scale_'+scale:true)).flatMap(r=>r.evidence.map(e=>e.id))
  if(!evidenceIds.length)continue
  let refs:StructuralReference[]=[]
  const bars=data.snapshot.bars[tf]
  const pivotsFor=(n:number)=>{
   const left=data.report.policy.structure.pivotLeft,right=data.report.policy.structure.pivotRight
   let all=cache.get(tf)
   if(!all){all=confirmedPivots(bars,left,right);cache.set(tf,all)}
   const offset=Math.max(0,bars.length-n)
   return all.filter(p=>p.pivotIndex>=offset+left).map(p=>({...p,pivotIndex:p.pivotIndex-offset,confirmedIndex:p.confirmedIndex-offset}))
  }
  const add=(kind:StructuralReference['kind'],price:number,source:StructuralReference['source'],from:string|null,through:string|null,rangeId?:StructuralReference['rangeId'])=>{
   const distance=(price-entry)*sign*(kind==='stop'?-1:1)
   if(distance<=0||!Number.isFinite(price))return
   refs.push({kind,price,source,scale,rangeId,points:distance/data.snapshot.pointSize,atrDistance:distance/atr,timeframe:tf,evidenceIds,from,through})
  }
  if(stage==='deep_history'){
   const contiguous=(n:number)=>bars.length>=n&&bars.slice(-n).every((b,i,all)=>i===0||Date.parse(b.closeTime)-Date.parse(all[i-1].closeTime)===TIMEFRAME_SECONDS[tf]*1000)
   // Each range or historical zone pool is an independent assessment: do not mix
   // opposite boundaries from different observation windows.
   const retainPool=(window:number)=>{
    if(refs.some(r=>r.kind==='stop')&&refs.some(r=>r.kind==='target'))
     out.push({...a,references:limitRefs(refs),metrics:{...a.metrics,atr,searchLookback:window}})
    refs=[]
   }
   if(primary==='range'){
    for(const n of policy.rangeSearchWindows){
     if(!contiguous(n+1))continue
     const r=inspectRange(bars,atr,{...EXPERIMENTAL_REGIME_POLICY,windows:{...EXPERIMENTAL_REGIME_POLICY.windows,range:n}})
     if(!r||entry<=r.lower||entry>=r.upper)continue
     const source=r.validated?'validated range boundary':'provisional range boundary'
     add('stop',sign===1?r.lower:r.upper,source,r.from,r.through,'outer')
     add('target',sign===1?r.upper:r.lower,source,r.from,r.through,'outer')
     retainPool(n)
    }
   }
   for(const n of policy.anchorSearchWindows){
    if(!contiguous(n))continue
    const history=bars.slice(-n),structure=inspectActiveStructure(history,atr,h.direction,n,pivotsFor(n))
    for(const z of structure?.zones??[]){
     if(sign===1?z.side==='support'&&z.upper<entry:z.side==='resistance'&&z.lower>entry)
      add('stop',sign===1?z.lower:z.upper,'active zone outer edge',structure!.from,z.confirmedThrough)
     if(sign===1?z.side==='resistance'&&z.lower>entry:z.side==='support'&&z.upper<entry)
      add('target',sign===1?z.lower:z.upper,'active zone near edge',structure!.from,z.confirmedThrough)
    }
    for(const pivot of pivotsFor(history.length)){
     const stop=pivot.side===(sign===1?'low':'high')
     if(stop&&history.slice(pivot.pivotIndex+1).some(b=>sign===1?b.low<pivot.price:b.high>pivot.price))continue
     // In a range, intact swing pairs are a distinct diagnostic geometry.
     add(stop?'stop':'target',pivot.price,'confirmed pivot',pivot.pivotTime,pivot.confirmedTime)
    }
    retainPool(n)
   }
   continue
  }
  if(primary==='range'&&larger){
   const r=larger.classification.range
   if(larger.classification.regime==='choppy'&&r&&entry>r.lower&&entry<r.upper){
    const source=r.validated?'validated range boundary':'provisional range boundary'
    add('stop',sign===1?r.lower:r.upper,source,r.from,r.through,'outer')
    add('target',sign===1?r.upper:r.lower,source,r.from,r.through,'outer')
   }
  }else if(primary!=='range'){
   // Larger profiles supply independently observed anchors, never cross-timeframe pairs.
   const structure=larger?inspectActiveStructure(bars,atr,h.direction,larger.rangeWindow*2,pivotsFor(larger.rangeWindow*2)):a.structure
   for(const z of structure?.zones??[]){
    if(sign===1?z.side==='support'&&z.upper<entry:z.side==='resistance'&&z.lower>entry)
     add('stop',sign===1?z.lower:z.upper,'active zone outer edge',structure!.from,z.confirmedThrough)
    if(sign===1?z.side==='resistance'&&z.lower>entry:z.side==='support'&&z.upper<entry)
     add('target',sign===1?z.lower:z.upper,'active zone near edge',structure!.from,z.confirmedThrough)
   }
   if(structure?.correction?.recovered&&primary==='continuation')add('stop',structure.correction.root.price,'correction root candidate',structure.correction.root.pivotTime,structure.correction.root.confirmedTime)
   const history=bars.slice(-(larger?larger.rangeWindow*2:100))
   for(const pivot of confirmedPivots(history,data.report.policy.structure.pivotLeft,data.report.policy.structure.pivotRight)){
    const stop=pivot.side===(sign===1?'low':'high')
    // Only intact confirmed extrema serve as alternative loss-side anchors.
    if(stop&&history.slice(pivot.pivotIndex+1).some(b=>sign===1?b.low<pivot.price:b.high>pivot.price))continue
    add(stop?'stop':'target',pivot.price,'confirmed pivot',pivot.pivotTime,pivot.confirmedTime)
   }
   if(primary==='countertrend'){
    const k=f.ichimoku.kijun.at(-1)
    if(k!=null)add('target',k,'equilibrium',history[0]?.closeTime??null,history.at(-1)?.closeTime??null)
   }
  }else if(stage==='alternative_anchors'){
   // A range rotation between repeated, intact support/resistance zones is a
   // separate diagnostic hypothesis, not a mixed inner/outer range pair.
   const structure=a.structure
   if(structure){
    for(const z of structure.zones){
     if(sign===1?z.side==='support'&&z.upper<entry:z.side==='resistance'&&z.lower>entry)
      add('stop',sign===1?z.lower:z.upper,'active zone outer edge',structure.from,z.confirmedThrough)
     if(sign===1?z.side==='resistance'&&z.lower>entry:z.side==='support'&&z.upper<entry)
      add('target',sign===1?z.lower:z.upper,'active zone near edge',structure.from,z.confirmedThrough)
    }
   }
  }
  const limited=limitRefs(refs)
  if(limited.length)out.push({...a,references:limited,metrics:{...a.metrics,atr}})
 }
 return out
}

/** Retain a representative spread, rather than only the nearest N anchors. */
function limitRefs(refs:StructuralReference[]){
 return (['stop','target'] as const).flatMap(kind=>{
  const unique=refs.filter(r=>r.kind===kind).sort((a,b)=>a.points-b.points).filter((r,i,all)=>all.findIndex(x=>x.price===r.price&&x.source===r.source)===i)
  if(unique.length<=policy.maxAnchorsPerSide)return unique
  return Array.from({length:policy.maxAnchorsPerSide},(_,i)=>unique[Math.round(i*(unique.length-1)/(policy.maxAnchorsPerSide-1))])
 })
}
