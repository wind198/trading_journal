import type { MarketSnapshot, Timeframe } from './contracts'

export const TIMEFRAME_SECONDS: Readonly<Record<Timeframe,number>> = {M3:180,M15:900}
export function validateSnapshot(snapshot: MarketSnapshot): string[] {
  const asOf=Date.parse(snapshot.asOf)
  if(!Number.isFinite(asOf)||snapshot.symbol!=='EURUSD'||!Number.isFinite(snapshot.pointSize)||snapshot.pointSize<=0)throw new Error('invalid snapshot metadata')
  const limitations:string[]=[]
  for(const tf of ['M3','M15'] as const){
    const step=TIMEFRAME_SECONDS[tf]*1000
    let previous:number|null=null
    let gaps=0
    for(const b of snapshot.bars[tf]){
      const time=Date.parse(b.closeTime)
      if(!Number.isFinite(time)||time>asOf||time%step!==0||(previous!==null&&time<=previous))throw new Error(tf+': invalid, open, duplicate or unordered bar')
      if([b.open,b.high,b.low,b.close].some(x=>!Number.isFinite(x)||x<=0)||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)||b.high<b.low)throw new Error(tf+': invalid OHLC')
      if(b.volume!==null&&(!Number.isFinite(b.volume)||b.volume<0))throw new Error(tf+': invalid volume')
      if(previous!==null&&time-previous!==step)gaps++
      previous=time
    }
    if(gaps)limitations.push(tf+': '+gaps+' cadence gaps; verify source and market closures')
    if(previous===null)limitations.push(tf+': no completed bars')
    else if(asOf-previous>=step)limitations.push(tf+': latest completed bar is stale or market is closed')
  }
  return limitations
}
