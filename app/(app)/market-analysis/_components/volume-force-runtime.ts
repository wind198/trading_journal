import {createVolumeForceCache,mergeVolumeForce,VWCF_POLICY,type VolumeForcePoint} from '@/lib/market-analysis/volume-weighted-force'
import type {Candle} from '@/lib/market-analysis/contracts'
import type {ISeriesApi,UTCTimestamp,HistogramData,WhitespaceData} from 'lightweight-charts'
export type VolumeForceRuntime={stop:()=>void}
export function mountVolumeForce(options:{series:ISeriesApi<'Histogram'>;bars:readonly Candle[];live:boolean;asOf:number;bull:string;bear:string;onStatus:(message:string)=>void;onPoints:(points:Map<number,VolumeForcePoint>,asOf:number)=>void}):VolumeForceRuntime{
 let cache=createVolumeForceCache(options.bars),asOf=options.asOf,stopped=false
 let controller:AbortController|null=null
 const point=(p:VolumeForcePoint):HistogramData<UTCTimestamp>|WhitespaceData<UTCTimestamp>=>{
  const time=Date.parse(p.closeTime)/1000 as UTCTimestamp
  if(p.value===null)return {time}
  const color=p.direction<0?options.bear:options.bull
  return {time,value:p.value,color:Date.parse(p.closeTime)>asOf||p.value<VWCF_POLICY.strongThreshold?'color-mix(in srgb, '+color+' 55%, transparent)':color}
 }
 const publish=()=>{options.onPoints(new Map(cache.points.map(p=>[Date.parse(p.closeTime)/1000,p])),asOf);options.onStatus(cache.points.some(p=>p.value!==null)?(options.live?'VW force · updated '+new Date(asOf).toISOString().slice(11,16)+' UTC':'VW force · historical'):'VW force · tick volume unavailable / warming up')}
 options.series.setData(cache.points.map(point));publish()
 const refresh=async()=>{
  if(stopped||controller||!options.live||document.hidden)return
  controller=new AbortController()
  try{
   const cursor=cache.bars.length?Date.parse(cache.bars.at(-1)!.closeTime):Math.floor(asOf/180000)*180000
   const response=await fetch('/api/market-analysis/volume-force?after='+cursor,{signal:controller.signal,cache:'no-store'})
   if(!response.ok)throw Error('refresh')
   const payload=await response.json() as {asOf:number;bars:Candle[]}
   if(stopped)return
   const old=cache,oldAsOf=asOf
   asOf=payload.asOf;cache=mergeVolumeForce(cache,payload.bars)
   const last=old.points.at(-1)?.closeTime
   // Historical corrections require historicalUpdate; new/active candles use update.
   const prior=new Map(old.points.map(p=>[p.closeTime,p]))
   for(const p of cache.points){
    const before=prior.get(p.closeTime)
    if(before===p&&(Date.parse(p.closeTime)>oldAsOf)===(Date.parse(p.closeTime)>asOf))continue
    if(last&&p.closeTime<last&&!before){options.series.setData(cache.points.map(point));break}
    options.series.update(point(p),!!last&&p.closeTime<last)
   }
   // Bound cache growth; truncate in batches, not on every minute.
   if(cache.bars.length>1200){cache=createVolumeForceCache(cache.bars.slice(-800));options.series.setData(cache.points.map(point))}
   publish()
  }catch{if(!stopped)options.onStatus('VW force · refresh failed; cached values retained')}
  finally{controller=null}
 }
 const timer=options.live?setInterval(()=>void refresh(),VWCF_POLICY.refreshIntervalMs):null
 if(options.live)void refresh()
 return {stop(){stopped=true;controller?.abort();if(timer!==null)clearInterval(timer)}}
}
