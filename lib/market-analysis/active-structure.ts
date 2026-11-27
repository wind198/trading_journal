import type { Candle } from './contracts'
import { confirmedPivots, type ConfirmedPivot } from './structure'
import policy from '../../ai/trading_knowledge/config/structure-policy.json' with { type: 'json' }

export interface ActiveZone {
  side: 'support' | 'resistance'
  lower: number
  upper: number
  tests: number
  pivots: ConfirmedPivot[]
  confirmedThrough: string
}
export interface CorrectionReference {
  root: ConfirmedPivot
  origin: ConfirmedPivot
  depthAtr: number
  recoveryAtr: number
  recovered: boolean
}
export function inspectActiveStructure(input: readonly Candle[], atr: number | null, direction: 'long'|'short',lookback=policy.lookback) {
  const bars=input.slice(-lookback)
  if(atr===null||!Number.isFinite(atr)||atr<=0||bars.length<policy.pivotLeft+policy.pivotRight+1)return null
  const pivots=confirmedPivots(bars,policy.pivotLeft,policy.pivotRight)
  const tolerance=atr*policy.zoneToleranceAtr,buffer=atr*policy.breakBufferAtr
  const zones:ActiveZone[]=[]
  for(const side of ['support','resistance'] as const){
    const candidates=pivots.filter(p=>p.side===(side==='support'?'low':'high'))
    // Partition by complete-link price width, not transitive chaining.
    const groups:ConfirmedPivot[][]=[]
    for(const p of [...candidates].sort((a,b)=>a.price-b.price)){
      const group=groups.at(-1)
      if(group&&p.price-group[0].price<=tolerance)group.push(p)
      else groups.push([p])
    }
    for(const group of groups){
      const ordered=[...group].sort((a,b)=>a.pivotIndex-b.pivotIndex)
      const separated:ConfirmedPivot[]=[]
      for(const p of ordered)if(!separated.length||p.pivotIndex-separated.at(-1)!.pivotIndex>=policy.minSeparationBars)separated.push(p)
      if(separated.length<policy.minTests)continue
      const lower=Math.min(...separated.map(p=>p.price)),upper=Math.max(...separated.map(p=>p.price))
      // A close through the outer edge after the first confirmed test invalidates
      // the candidate. No automatic support/resistance role reversal.
      const broken=bars.slice(separated[0].confirmedIndex+1).some(b=>side==='support'?b.close<lower-buffer:b.close>upper+buffer)
      if(broken)continue
      zones.push({side,lower,upper,tests:separated.length,pivots:separated,confirmedThrough:separated.at(-1)!.confirmedTime})
    }
  }
  const sign=direction==='long'?1:-1
  const root=pivots.filter(p=>p.side===(sign===1?'low':'high')).at(-1)
  const origin=root?pivots.filter(p=>p.side===(sign===1?'high':'low')&&p.pivotIndex<root.pivotIndex).at(-1):undefined
  let correction:CorrectionReference|null=null
  if(root&&origin){
    const depthAtr=(origin.price-root.price)*sign/atr
    const recoveryAtr=(bars.at(-1)!.close-root.price)*sign/atr
    const violated=bars.slice(root.pivotIndex+1).some(b=>sign===1?b.low<root.price:b.high>root.price)
    if(depthAtr>=policy.minCorrectionDepthAtr&&!violated&&recoveryAtr>=0)
      correction={root,origin,depthAtr,recoveryAtr,recovered:recoveryAtr>=policy.minRecoveryAtr}
  }
  return {zones,correction,from:bars[0].closeTime,through:bars.at(-1)!.closeTime,policyVersion:policy.version}
}
export type ActiveStructure=NonNullable<ReturnType<typeof inspectActiveStructure>>
export function structuralPriceSpace(structure:ActiveStructure,entry:number,direction:'long'|'short',target:number|null){
  const long=direction==='long'
  const stops=structure.zones.filter(z=>long?z.side==='support'&&z.upper<entry:z.side==='resistance'&&z.lower>entry)
    .sort((a,b)=>long?b.upper-a.upper:a.lower-b.lower)
  const targets=structure.zones.filter(z=>long?z.side==='resistance'&&z.upper>entry:z.side==='support'&&z.lower<entry)
    .sort((a,b)=>long?a.lower-b.lower:b.upper-a.upper)
  const obstacles=target===null?[]:targets.filter(z=>long?z.lower<=target:z.upper>=target)
  return {stop:stops[0]??null,target:targets[0]??null,obstacles}
}
