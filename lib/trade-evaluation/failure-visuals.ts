import type { FailedOption } from './options'
import { TRADE_RISK_POLICY, minimumTargetPoints } from './policy'
export function failureComparisons(option:FailedOption){
 const p=TRADE_RISK_POLICY.hardConstraints
 return [
 {id:'sl',label:'Stop distance',actual:option.riskPoints,required:p.minStopLossPoints,unit:'pts'},
 {id:'tp',label:'Target distance',actual:option.rewardPoints,required:p.minTakeProfitPoints,unit:'pts'},
 {id:'rr',label:'Reward / risk minimum',actual:option.grossRewardRisk,required:p.minRewardRiskRatio,unit:'',maximum:false},
 {id:'rr-max',label:'Reward / risk maximum',actual:option.grossRewardRisk,required:p.maxRewardRiskRatio,unit:'',maximum:true},
 {id:'space',label:'Reward space required for this stop',actual:option.rewardPoints,required:minimumTargetPoints(option.riskPoints),unit:'pts'}
 ].map(v=>({...v,failed:v.maximum===true?v.actual>v.required:v.actual<v.required}))
}
export function failureLabel(state:FailedOption['failureState']){
 return ({failed_hard_policy:'Hard risk limit failed',failed_structure:'Structural space infeasible',failed_context:'Context unresolved',failed_data_quality:'Data quality insufficient'})[state]
}
/** Pick a diverse initial subset, without ranking trading quality. All remain inspectable. */
export function orderFailedOptions(options:readonly FailedOption[]){
 const remaining=[...options],ordered:FailedOption[]=[],seen=new Set<string>()
 for(const o of remaining){
  const key=o.failureState+':'+o.review.warnings.filter(w=>w.severity==='block'||w.severity==='unassessed'||w.code==='STRUCTURAL_SPACE_INFEASIBLE').map(w=>w.code).sort().join(',')
  if(!seen.has(key)){seen.add(key);ordered.push(o)}
 }
 return [...ordered,...remaining.filter(o=>!ordered.includes(o))]
}
