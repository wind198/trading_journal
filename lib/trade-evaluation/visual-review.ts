import type { OptionPair } from './options'
import type { ReviewWarning } from './policy'
import type { StrategyAssessment, StructuralReference } from './strategies'

export function referenceLabel(r:StructuralReference){
 if(r.rangeId)return (r.rangeId==='inner'?'Inner':'Outer')+' range'+(r.source==='provisional range boundary'?' (provisional)':'')
 return r.source==='correction root candidate'?'Correction root (candidate)':r.source
}
export function optionTitle(o:OptionPair){
 return o.stopReference.timeframe+' · '+referenceLabel(o.stopReference)
}
export function setupAnnotations(o:OptionPair,entry:number,warnings:readonly ReviewWarning[],assessment?:StrategyAssessment){
 const levels=[
  {price:o.stopReference.price,label:'SL anchor: '+referenceLabel(o.stopReference)},
  {price:o.targetReference.price,label:'TP anchor: '+referenceLabel(o.targetReference)},
 ]
 for(const z of assessment?.structure?.obstacles??[]){
  const price=o.takeProfitPrice>entry?z.lower:z.upper
  if((price-entry)*(o.takeProfitPrice-entry)>0&&Math.abs(price-entry)<=Math.abs(o.takeProfitPrice-entry))
    levels.push({price,label:'Target obstacle'})
 }
 const short:Partial<Record<ReviewWarning['code'],string>>={
  SL_INSIDE_NOISE:'Stop within noise',SL_BEFORE_INVALIDATION:'Stop before invalidation',SL_ACTIVE_ZONE_EXPOSURE:'Stop exposed to zone',
  SL_INNER_RANGE_EXPOSURE:'Stop inside inner range',SL_CORRECTION_ROOT_EXPOSURE:'Root exposure',
  TP_INNER_RANGE_OBSTACLE:'Inner range obstacle',TP_ACTIVE_ZONE_OBSTACLES:'Structural obstacles',TP_STRUCTURAL_OBSTRUCTION:'Target crosses reference',
  TP_EXCESSIVE_EXTENSION:'Extended target',TP_OUTSIDE_VALIDATED_RANGE:'Outside range',TP_BELOW_PREFERRED:'Below preferred target',
  CONTINUATION_UNCONFIRMED:'Recovery unconfirmed',CORRECTION_ADVERSE_MOMENTUM:'Opposing momentum',RANGE_ADVERSE_PRESSURE:'Opposing pressure',
  ENTRY_RANGE_LOCATION:'Unfavorable range entry',ENTRY_TIMEFRAME_CONFLICT:'Opposes M15 trend',PROVISIONAL_RANGE_BOUNDARY:'Provisional boundaries',
  RANGE_BOUNDARY_PENETRATION:'Boundary penetration',STRUCTURAL_TRANSITION_UNCONFIRMED:'Breakout unconfirmed',
  CORRECTION_RECOVERY_UNCONFIRMED:'Recovery unconfirmed',ENTRY_OVEREXTENDED:'Extended entry',
  FORCE_COVERAGE_LIMITED:'Force evidence incomplete',FORCE_ACTIVE_EQUILIBRIUM:'Active force balance',FORCE_PASSIVE_EQUILIBRIUM:'Weak force balance',
  FORCE_ADVERSE_PERSISTENCE:'Persistent opposing force',FORCE_ADVERSE_ACCELERATION:'Opposing force growing',FORCE_BOUNDARY_PRESSURE:'Boundary under pressure',FORCE_ABSORPTION_CANDIDATE:'Possible absorption'
 }
 const callouts=(['entry','stop','target'] as const).map(dimension=>{
   const matching=warnings.filter(w=>w.dimension===dimension)
   const local=matching.filter(w=>!w.timeframe||w.timeframe===o.stopReference.timeframe)
   const w=local.find(w=>w.code.startsWith('FORCE_')&&w.anchorPrice!==undefined)??local.find(w=>w.code.startsWith('FORCE_'))??local[0]??matching[0]
   return w?{dimension,price:w.timeframe===o.stopReference.timeframe&&w.anchorPrice!==undefined?w.anchorPrice:dimension==='entry'?entry:dimension==='stop'?o.stopLossPrice:o.takeProfitPrice,label:(w.timeframe?w.timeframe+' · ':'')+(short[w.code]??w.code.toLowerCase().replaceAll('_',' ')),count:matching.length}:null
 }).filter(x=>x!==null)
 return {levels:levels.filter((l,i)=>levels.findIndex(x=>x.price===l.price)===i).slice(0,4),callouts}
}
