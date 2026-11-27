import type {Candle} from './contracts'
import {candleFeatures,quantile} from '../market-indicators/candle-features'
import {calculateForceScoreFromFeatures} from '../market-indicators/force-candles'
import {defaultForceCandlesConfig} from '../market-indicators/force-candles-config'
import policy from '../../ai/trading_knowledge/config/volume-weighted-force.json' with {type:'json'}
export const VWCF_POLICY=policy
const cfg=defaultForceCandlesConfig()
export const VWCF_WARMUP=Math.max(policy.lookback,cfg.lookback)
export interface VolumeForcePoint{closeTime:string;force:number|null;tickCount:number|null;relativeVolume:number|null;value:number|null;direction:-1|0|1}
export function volumeForceAt(bars:readonly Candle[],i:number):VolumeForcePoint{
 const b=bars[i]!,feature=candleFeatures({...b,time:Date.parse(b.closeTime)/1000-180})
 const out:VolumeForcePoint={closeTime:b.closeTime,force:null,tickCount:b.volume,relativeVolume:null,value:null,direction:feature.direction}
 if(i<cfg.lookback||feature.invalidCandle)return out
 const prev=bars.slice(i-cfg.lookback,i)
 const body=quantile(prev.map(b=>Math.abs(b.close-b.open)),cfg.percentile/100),range=quantile(prev.map(b=>b.high-b.low),cfg.percentile/100)
 if(!(body>0&&range>0))return out
 out.force=feature.direction===0?0:Math.max(0,Math.min(100,calculateForceScoreFromFeatures(feature,feature.body/body,feature.range/range,cfg)))
 if(i<policy.lookback||b.volume===null||!Number.isSafeInteger(b.volume)||b.volume<0)return out
 const volumes=bars.slice(i-policy.lookback,i).map(b=>b.volume)
 if(volumes.some(v=>v===null||!Number.isSafeInteger(v)||v<0))return out
 const p95=quantile(volumes as number[],policy.volumePercentile)
 if(!(p95>0))return out
 out.relativeVolume=Math.min(1,b.volume/p95)
 out.value=out.force*out.relativeVolume
 return out
}
export function volumeForceSeries(bars:readonly Candle[]){return bars.map((_,i)=>volumeForceAt(bars,i))}
export interface VolumeForceCache{bars:Candle[];points:VolumeForcePoint[]}
export function createVolumeForceCache(bars:readonly Candle[]):VolumeForceCache{return {bars:[...bars],points:volumeForceSeries(bars)}}
/** Recompute changed candles and their causal dependents, not the unchanged prefix. */
export function mergeVolumeForce(cache:VolumeForceCache,incoming:readonly Candle[]):VolumeForceCache{
 const byTime=new Map(cache.bars.map(b=>[b.closeTime,b]))
 for(const b of incoming)byTime.set(b.closeTime,b)
 const bars=[...byTime.values()].sort((a,b)=>a.closeTime.localeCompare(b.closeTime))
 const oldIndex=new Map(cache.bars.map((b,i)=>[b.closeTime,i]))
 let dirtyThrough=-1
 const points=bars.map((b,i)=>{
  const j=oldIndex.get(b.closeTime),old=j===undefined?undefined:cache.bars[j]
  if(!old||j!==i||old.open!==b.open||old.high!==b.high||old.low!==b.low||old.close!==b.close||old.volume!==b.volume)dirtyThrough=i+VWCF_WARMUP
  return i<=dirtyThrough||j===undefined?volumeForceAt(bars,i):cache.points[j]!
 })
 return {bars,points}
}
