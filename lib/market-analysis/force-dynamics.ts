import type { Candle } from './contracts'
import policy from '../../ai/trading_knowledge/config/choppy-force-policy.json' with {type:'json'}
export const FORCE_DYNAMICS_POLICY=policy

type ForceSeries=readonly (number|null)[]
export function forceWindow(series:ForceSeries,n:number){
 const values=series.slice(-n)
 const valid=values.filter((v):v is number=>v!==null&&Number.isFinite(v)&&Math.abs(v)<=100)
 const coverage=valid.length/n
 if(valid.length!==n)return {coverage,bull:null,bear:null,pressure:null,intensity:null,bullPersistence:null,bearPersistence:null}
 const bull=valid.reduce((s,v)=>s+Math.max(v,0),0)/n
 const bear=valid.reduce((s,v)=>s+Math.max(-v,0),0)/n
 return {coverage,bull,bear,pressure:bull+bear>0?(bull-bear)/(bull+bear):null,intensity:bull+bear,
  bullPersistence:valid.filter(v=>v>0).length/n,bearPersistence:valid.filter(v=>v<0).length/n}
}
export function observeForceDynamics(bars:readonly Candle[],series:ForceSeries,atr:number|null){
 const windows=policy.windows.map(n=>({n,...forceWindow(series,n)}))
 const short=windows[0],medium=windows[1],broad=windows[2]
 const prior=forceWindow(series.slice(0,-short.n),short.n)
 const history:number[]=[]
 // Use prior rolling windows (overlapping with one another, not current).
 for(let end=Math.max(broad.n,series.length-broad.n-policy.intensityHistory+1);end<=series.length-broad.n;end++){
  const v=forceWindow(series.slice(0,end),broad.n).intensity
  if(v!==null)history.push(v)
 }
 const intensityPercentile=broad.intensity!==null&&history.length>=policy.minIntensityHistory?
  history.reduce((s,v)=>s+(v<broad.intensity!?1:v===broad.intensity?0.5:0),0)/history.length:null
 const pressureChange=short.pressure!==null&&prior.pressure!==null?short.pressure-prior.pressure:null
 const bullChange=short.bull!==null&&prior.bull!==null?short.bull-prior.bull:null
 const bearChange=short.bear!==null&&prior.bear!==null?short.bear-prior.bear:null
 const valid=bars.length===series.length&&bars.length>short.n&&atr!==null&&Number.isFinite(atr)&&atr>0
 const displacementAtr=valid?(bars.at(-1)!.close-bars.at(-short.n-1)!.close)/atr!:null
 const sideEfficiency=(side:1|-1)=>{
  const mean=side===1?short.bull:short.bear
  return displacementAtr!==null&&mean!==null&&mean>0?(displacementAtr*side)/(mean/100*short.n):null
 }
 const balanced=broad.pressure!==null&&Math.abs(broad.pressure)<=policy.balanceMax
 const emergingBull=short.pressure!==null&&pressureChange!==null&&short.pressure>=policy.dominanceMin&&pressureChange>=policy.pressureChangeMin&&bullChange!==null&&bullChange>0&&bearChange!==null&&bearChange<0
 const emergingBear=short.pressure!==null&&pressureChange!==null&&short.pressure<=-policy.dominanceMin&&pressureChange<=-policy.pressureChangeMin&&bearChange!==null&&bearChange>0&&bullChange!==null&&bullChange<0
 const state=emergingBull?'emerging_bull':emergingBear?'emerging_bear':
  balanced&&intensityPercentile!==null&&intensityPercentile>=policy.highIntensityPercentile?'active_equilibrium':
  balanced&&intensityPercentile!==null&&intensityPercentile<=policy.lowIntensityPercentile?'passive_equilibrium':
  balanced?'balanced':short.pressure===null?'unresolved':'mixed'
 return {windows,short,medium,broad,prior,pressureChange,bullChange,bearChange,intensityPercentile,historySamples:history.length,
  displacementAtr,bullEfficiency:sideEfficiency(1),bearEfficiency:sideEfficiency(-1),state,policyVersion:policy.version}
}
export type ForceDynamics=ReturnType<typeof observeForceDynamics>
