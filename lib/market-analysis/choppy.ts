import type { Candle } from './contracts'
import { inspectRange, EXPERIMENTAL_REGIME_POLICY } from './regimes'
import policy from '../../ai/trading_knowledge/config/choppy-policy.json' with {type:'json'}

type Range = NonNullable<ReturnType<typeof inspectRange>>
export interface RangeBand {
  id:'outer'|'inner'
  lower:number
  upper:number
  validated:boolean
  upperTests:number
  lowerTests:number
  from:string
  through:string
  widthAtr:number
  upperPenetrationAtr:number
  lowerPenetrationAtr:number
  closeOutside:boolean
}
function band(id:RangeBand['id'],r:Range,current:Candle,atr:number):RangeBand{
  return {id,lower:r.lower,upper:r.upper,validated:r.validated,upperTests:r.upperTests,lowerTests:r.lowerTests,from:r.from,through:r.through,widthAtr:r.widthAtr,
    upperPenetrationAtr:Math.max(0,current.high-r.upper)/atr,lowerPenetrationAtr:Math.max(0,r.lower-current.low)/atr,closeOutside:current.close>r.upper||current.close<r.lower}
}
export function inspectChoppyRanges(bars:readonly Candle[],atr:number|null,outer:Range|null){
  const current=bars.at(-1)
  if(!outer||!current||atr===null||!Number.isFinite(atr)||atr<=0||outer.upper<=outer.lower)return null
  const outerBand=band('outer',outer,current,atr)
  const p=EXPERIMENTAL_REGIME_POLICY
  const local=inspectRange(bars,atr,{...p,windows:{...p.windows,range:policy.innerWindow}})
  const inner=local&&local.lower>=outer.lower&&local.upper<=outer.upper&&local.widthAtr>=policy.minInnerWidthAtr&&
    (local.upper-local.lower)/(outer.upper-outer.lower)<=policy.maxInnerOuterWidthRatio&&
    (local.lower-outer.lower>=atr*policy.minBoundaryInsetAtr||outer.upper-local.upper>=atr*policy.minBoundaryInsetAtr)
    ?band('inner',local,current,atr):null
  return {outer:outerBand,inner,subtype:outerBand.closeOutside?'breakout_candidate' as const:inner&&!inner.closeOutside?'nested_consolidation_candidate' as const:outer.validated?'established_range' as const:'irregular_chop' as const,policyVersion:policy.version}
}
export type ChoppyRanges=NonNullable<ReturnType<typeof inspectChoppyRanges>>
export const PENETRATION_WARNING_ATR=policy.penetrationWarningAtr
