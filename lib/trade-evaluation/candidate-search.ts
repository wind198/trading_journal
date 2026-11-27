import type {OptionPair,TradeOption,FailedOption} from './options'
import {farthest} from './candidate-diversity'
import policy from '../../ai/trading_knowledge/config/option-policy.json' with {type:'json'}
export type SeedId='local_rotation'|'local_correction'|'primary_structure'|'extended_structure'|'macro_structure'|'tight_invalidation'|'deep_invalidation'|'equilibrium'
export const SEEDS:SeedId[]=['local_rotation','local_correction','primary_structure','extended_structure','macro_structure','tight_invalidation','deep_invalidation','equilibrium']
export type SeedCandidate=OptionPair&{seed:SeedId;hardPass:boolean}
export function seedCandidates(pool:readonly SeedCandidate[]){
 const sorted=[...pool].sort((a,b)=>a.riskPoints-b.riskPoints||a.rewardPoints-b.rewardPoints||a.id.localeCompare(b.id))
 const mid=sorted[Math.floor(sorted.length/2)]?.riskPoints??0
 const queues=SEEDS.map(seed=>{
  const eligible=sorted.filter(c=>seed==='local_rotation'?c.stopReference.timeframe==='M3'&&!!c.stopReference.rangeId:
   seed==='local_correction'?c.stopReference.timeframe==='M3'&&(c.stopReference.source==='correction root candidate'||c.stopReference.source==='confirmed pivot'):
   seed==='primary_structure'?c.stopReference.timeframe==='M15'&&(c.stopReference.scale??'baseline')==='baseline':
   seed==='extended_structure'?c.stopReference.scale==='extended':
   seed==='macro_structure'?c.stopReference.scale==='structural'||c.searchStage==='deep_history':
   seed==='tight_invalidation'?c.riskPoints<=mid:seed==='deep_invalidation'?c.riskPoints>=mid:c.targetReference.source==='equilibrium')
  // Bound queue size with farthest-first representatives in each outcome class.
  const shortlist:SeedCandidate[]=[]
  for(const pass of [true,false]){
   const candidates=eligible.filter(c=>c.hardPass===pass)
   const selected:SeedCandidate[]=[]
   while(selected.length<policy.maxGeometryPerSeed/2){
    const c=farthest(candidates,selected)
    if(!c)break
    selected.push({...c,seed})
   }
   shortlist.push(...selected)
  }
  return {seed,eligible:eligible.length,queue:shortlist}
 })
 return queues
}
export function selectFinal(passed:readonly TradeOption[],failed:readonly FailedOption[]){
 const chosen:TradeOption[]=[]
 const pick=(pool:readonly TradeOption[])=>{const next=farthest(pool,chosen);if(next)chosen.push(next);return !!next}
 while(chosen.length<policy.preferredPassed&&pick(passed)){}
 // Retain at least one informative failure when geometry allows, then favor
 // coverage, not an invented probability or quality score.
 if(chosen.length<policy.targetTotal)pick(failed)
 while(chosen.length<policy.targetTotal&&pick([...passed,...failed])){}
 const passIds=new Set(passed.map(o=>o.id))
 return {options:chosen.filter(o=>passIds.has(o.id)),failedOptions:chosen.filter((o):o is FailedOption=>!passIds.has(o.id)&&'failureState'in o)}
}
