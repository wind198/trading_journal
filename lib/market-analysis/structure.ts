import type { Candle } from './contracts'

export interface ConfirmedPivot {
  side: 'high' | 'low'
  price: number
  pivotIndex: number
  confirmedIndex: number
  pivotTime: string
  confirmedTime: string
}
export function confirmedPivots(bars: readonly Candle[], left: number, right: number): ConfirmedPivot[] {
  if (![left,right].every(n=>Number.isSafeInteger(n)&&n>0&&n<=1000)) throw new RangeError('invalid pivot window')
  const out: ConfirmedPivot[]=[]
  for(let i=left;i+right<bars.length;i++){
    const b=bars[i]
    const neighbors=bars.slice(i-left,i+right+1).filter((_,j)=>j!==left)
    for(const side of ['high','low'] as const){
      // Strict extrema: ties deliberately produce no pivot.
      if(neighbors.every(x=>side==='high'?b.high>x.high:b.low<x.low)){
        out.push({side,price:b[side],pivotIndex:i,confirmedIndex:i+right,pivotTime:b.closeTime,confirmedTime:bars[i+right].closeTime})
      }
    }
  }
  return out
}
export function observedRange(bars: readonly Candle[], lookback: number) {
  if(!Number.isSafeInteger(lookback)||lookback<2)throw new RangeError('invalid lookback')
  if(bars.length<lookback+1)return null
  // Freeze historical bounds excluding current bar; not a confirmed structural channel.
  const previous=bars.slice(-lookback-1,-1)
  const upper=previous.reduce((v,b)=>Math.max(v,b.high),-Infinity)
  const lower=previous.reduce((v,b)=>Math.min(v,b.low),Infinity)
  return {upper,lower,from:previous[0].closeTime,through:previous[previous.length-1].closeTime}
}
