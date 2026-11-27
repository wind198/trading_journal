import type { ChoppyRanges } from '../market-analysis/choppy'
import type { ActiveStructure, ActiveZone } from '../market-analysis/active-structure'
import type { EvaluationContext, StrategyId } from './context'
import { TRADE_RISK_POLICY as policy, type ReviewWarning, type WarningCode, minimumTargetPoints } from './policy'

export interface StructuralReference {
  rangeId?: 'outer' | 'inner'
  kind: 'stop' | 'target'
  price: number
  points: number
  atrDistance: number | null
  timeframe: EvaluationContext['timeframe']
  source: 'confirmed pivot' | 'validated range boundary' | 'provisional range boundary' | 'equilibrium' | 'active zone outer edge' | 'active zone near edge' | 'correction root candidate'
  evidenceIds: readonly string[]
  from: string | null
  through: string | null
}
export interface StrategyAssessment {
  strategy: StrategyId | 'correction_entry'
  timeframe: EvaluationContext['timeframe']
  metrics: Record<string, number | null>
  references: StructuralReference[]
  warnings: ReviewWarning[]
  limitations: string[]
  feasibleWithinReferences: boolean | null
  choppy?: ChoppyRanges
  structure?: ActiveStructure & { obstacles: ActiveZone[] }
}
type Draft = Pick<StrategyAssessment,'metrics'|'references'|'warnings'|'limitations'>
function draft(): Draft { return {metrics:{},references:[],warnings:[],limitations:[]} }
const divide=(x:number,a:number|null)=>a!==null&&a>0?x/a:null
function warn(c:EvaluationContext,d:Draft,code:WarningCode,dimension:ReviewWarning['dimension'],message:string,severity:ReviewWarning['severity']='warning'){
  d.warnings.push({code,dimension,message,severity,timeframe:c.timeframe,evidenceIds:c.evidenceIds})
}
function ref(c:EvaluationContext,d:Draft,kind:StructuralReference['kind'],price:number,source:StructuralReference['source']){
  const distance=(price-c.entry)*c.sign*(kind==='stop'?-1:1)
  if(distance<=0)return
  d.references.push({kind,price,points:distance/c.pointSize,atrDistance:divide(distance,c.atr),timeframe:c.timeframe,source,evidenceIds:c.evidenceIds,from:c.from,through:c.through})
}
function pivots(c:EvaluationContext,d:Draft){
  if(c.stopPivot)ref(c,d,'stop',c.stopPivot.price,'confirmed pivot')
  if(c.targetPivot)ref(c,d,'target',c.targetPivot.price,'confirmed pivot')
  d.limitations.push('Confirmed historical pivots are candidate obstacles, not established trend roots or guaranteed active levels.')
}
function checkDistances(c:EvaluationContext,d:Draft,minStopAtr:number,maxTargetAtr?:number){
  const stop=c.h.stopLossPrice,target=c.h.takeProfitPrice
  const stopAtr=stop===null?null:divide((c.entry-stop)*c.sign,c.atr)
  const targetAtr=target===null?null:divide((target-c.entry)*c.sign,c.atr)
  d.metrics.stopAtr=stopAtr;d.metrics.targetAtr=targetAtr
  if(stopAtr!==null&&stopAtr>0&&stopAtr<minStopAtr)warn(c,d,'SL_INSIDE_NOISE','stop','Stop distance is below the experimental '+minStopAtr+' ATR threshold for this strategy.')
  if(maxTargetAtr!==undefined&&targetAtr!==null&&targetAtr>maxTargetAtr)warn(c,d,'TP_EXCESSIVE_EXTENSION','target','Target displacement exceeds the experimental '+maxTargetAtr+' ATR threshold.')
  const s=d.references.find(r=>r.kind==='stop'),t=d.references.find(r=>r.kind==='target')
  if(s&&stop!==null&&(stop-s.price)*c.sign>=0)warn(c,d,'SL_BEFORE_INVALIDATION','stop','Stop is at or before the candidate structural reference; actual invalidation is not established.')
  if(t&&target!==null&&(target-t.price)*c.sign>0)warn(c,d,t.source==='validated range boundary'?'TP_OUTSIDE_VALIDATED_RANGE':'TP_STRUCTURAL_OBSTRUCTION','target','Target extends beyond the first identified reference and assumes additional price movement.')
}
function continuation(c:EvaluationContext,d:Draft){
  const p=policy.experimental.continuation
  pivots(c,d)
  const extension=c.kijun===null?null:divide((c.entry-c.kijun)*c.sign,c.atr)
  d.metrics.entryKijunAtr=extension
  if(extension!==null&&extension>p.maxEntryExtensionAtr)warn(c,d,'ENTRY_OVEREXTENDED','entry','Entry is extended in the trend direction relative to Kijun.')
  checkDistances(c,d,p.minStopAtr,p.maxTargetAtr)
  d.limitations.push('Correction completion, trend root and recovery of opposing momentum are not yet established.')
}
function countertrend(c:EvaluationContext,d:Draft){
  const p=policy.experimental.countertrend
  pivots(c,d)
  const extension=c.kijun===null?null:divide((c.kijun-c.entry)*c.sign,c.atr)
  d.metrics.entryCountertrendExtensionAtr=extension
  d.metrics.adversePressure=c.pressure===null?null:-c.sign*c.pressure
  if(extension!==null&&extension<p.minExtensionAtr)warn(c,d,'COUNTERTREND_NOT_EXTENDED','entry','Entry lacks the configured countertrend extension evidence.')
  if(d.metrics.adversePressure!==null&&d.metrics.adversePressure>p.maxAdversePressure)warn(c,d,'COUNTERTREND_ADVERSE_MOMENTUM','entry','Measured directional pressure opposes the proposed trade.')
  if(c.kijun!==null&&(!c.targetPivot||Math.abs(c.kijun-c.entry)<Math.abs(c.targetPivot.price-c.entry))&&(c.kijun-c.entry)*c.sign>0){
    d.references=d.references.filter(r=>r.kind!=='target')
    ref(c,d,'target',c.kijun,'equilibrium')
  }
  checkDistances(c,d,p.minStopAtr,p.maxTargetAtr)
  d.limitations.push('Extension is not exhaustion. A reversal or exhaustion pattern has not been confirmed.')
}
function range(c:EvaluationContext,d:Draft){
  const p=policy.experimental.range,r=c.range
  if(!r||r.upper<=r.lower){warn(c,d,'DATA_INSUFFICIENT','data','No usable observed range available.','unassessed');return}
  const source=r.validated?'validated range boundary':'provisional range boundary'
  if(!r.validated)warn(c,d,'PROVISIONAL_RANGE_BOUNDARY','entry','Observed extremes are provisional; repeated boundary tests are insufficient.')
  d.metrics.boundaryValidated=Number(r.validated);d.metrics.upperBoundaryTests=r.upperTests;d.metrics.lowerBoundaryTests=r.lowerTests;d.metrics.rangeWidthAtr=r.widthAtr
  d.metrics.adversePressure=c.pressure===null?null:-c.sign*c.pressure
  if(d.metrics.adversePressure!==null&&d.metrics.adversePressure>policy.experimental.countertrend.maxAdversePressure)warn(c,d,'RANGE_ADVERSE_PRESSURE','entry','Directional pressure opposes range rotation.')
  const position=(c.entry-r.lower)/(r.upper-r.lower)
  const fraction=c.sign===1?position:1-position
  d.metrics.rangePosition=position;d.metrics.entryFraction=fraction
  if(fraction<0||fraction>p.maxEntryFraction)warn(c,d,'ENTRY_RANGE_LOCATION','entry','Entry is outside the range or too far from the favorable boundary.')
  if(position<0||position>1){warn(c,d,'RANGE_BOUNDARY_BREAKOUT','entry','Entry lies outside observed boundaries; rotation references withheld.');return}
  ref(c,d,'stop',c.sign===1?r.lower:r.upper,source)
  ref(c,d,'target',c.sign===1?r.upper:r.lower,source)
  checkDistances(c,d,p.minStopAtr)
  d.limitations.push('Range boundary penetration and breakout probability have not been calibrated.')
}
function transition(c:EvaluationContext,d:Draft){
  const p=policy.experimental.transition
  warn(c,d,'TRANSITION_INSTABILITY','entry','Regime is changing; breakout persistence and retest validity are not established.')
  checkDistances(c,d,p.minStopAtr,p.maxTargetAtr)
  d.limitations.push('Structural SL and TP references withheld in transition until breakout invalidation is established.')
}
const strategies:Record<Exclude<StrategyId,'unknown'>,(c:EvaluationContext,d:Draft)=>void>={continuation,countertrend,range,transition}
export function evaluateStrategy(c:EvaluationContext,mode?:'correction_entry'):StrategyAssessment{
  const d=draft()
  d.metrics.atr=c.atr
  if(c.strategy==='unknown'){
    warn(c,d,c.stale?'DATA_INSUFFICIENT':'REGIME_UNCERTAIN','data','Market regime cannot be established for this timeframe.','unassessed')
  }else{
    if(c.atr===null||c.atr<=0)warn(c,d,'DATA_INSUFFICIENT','data','ATR unavailable.','unassessed')
    if(mode==='correction_entry'&&c.strategy==='countertrend'){
      const p=policy.experimental.continuation
      pivots(c,d)
      d.metrics.entryKijunAtr=c.kijun===null?null:divide((c.entry-c.kijun)*c.sign,c.atr)
      d.metrics.adversePressure=c.pressure===null?null:-c.sign*c.pressure
      checkDistances(c,d,p.minStopAtr,p.maxTargetAtr)
      if(d.metrics.adversePressure!==null&&d.metrics.adversePressure>policy.experimental.countertrend.maxAdversePressure)
        warn(c,d,'CORRECTION_ADVERSE_MOMENTUM','entry','Local force still opposes the broader continuation hypothesis.')
      d.limitations.push('Local pivots are provisional correction references; correction root and completion are not confirmed.')
    }else strategies[c.strategy](c,d)
  }
  const s=d.references.find(r=>r.kind==='stop'),t=d.references.find(r=>r.kind==='target')
  // Only a validated range is strong enough to test constrained rotation feasibility.
  // Strictly beyond the stop boundary: one additional point; no invented buffer.
  const feasibleWithinReferences=c.strategy==='range'&&c.range?.validated&&s&&t
    ? Math.floor(t.points+1e-7)>=minimumTargetPoints(Math.max(policy.hardConstraints.minStopLossPoints,Math.floor(s.points+1e-7)+1)):null
  if(feasibleWithinReferences===false)warn(c,d,'STRUCTURAL_SPACE_INFEASIBLE','risk','Within these range boundaries the minimum structural stop and hard reward/risk cannot both be satisfied.')
  return {strategy:mode??c.strategy,timeframe:c.timeframe,...d,feasibleWithinReferences}
}
