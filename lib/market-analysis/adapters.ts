import type { Candle, MarketSnapshot, Timeframe } from './contracts'
import { calculateForceScores } from '../market-indicators/force-candles'
import { defaultForceCandlesConfig } from '../market-indicators/force-candles-config'
import { buildVolumeProfile, type VolumeProfileBin } from '../market-indicators/volume-profile'
import { TIMEFRAME_SECONDS } from './snapshot'
import { ratio } from './indicators'
import { rollingQuantile } from '../market-indicators/candle-features'

export function forceSeries(bars: readonly Candle[], timeframe: Timeframe) {
  const cfg=defaultForceCandlesConfig()
  const input=bars.map(b=>({...b,time:Date.parse(b.closeTime)/1000-TIMEFRAME_SECONDS[timeframe]}))
  const scores=new Map(calculateForceScores(input,cfg).map(p=>[p.time,p]))
  const bodies=input.map(b=>Math.abs(b.close-b.open)),ranges=input.map(b=>b.high-b.low)
  return input.map((b,i)=>{
    const p=scores.get(b.time)
    if(p)return p.direction==='BULLISH'?p.score:-p.score
    // Neutral valid candles after warmup contribute zero, undefined baselines remain null.
    if(i>=cfg.lookback&&b.open===b.close&&b.high>b.low&&rollingQuantile(bodies,i,cfg.lookback,cfg.percentile)>0&&rollingQuantile(ranges,i,cfg.lookback,cfg.percentile)>0)return 0
    return null
  })
}
export function summarizeForce(series: readonly (number|null)[], lookback: number) {
  if(!Number.isSafeInteger(lookback)||lookback<1)throw new RangeError('invalid force window')
  const window=series.slice(-lookback)
  const valid=window.filter((x):x is number=>x!==null)
  if(window.length!==lookback||valid.length!==lookback)return {bullForce:null,bearForce:null,pressure:null,coverage:valid.length/lookback}
  const bullForce=valid.reduce((s,x)=>s+Math.max(0,x),0)
  const bearForce=valid.reduce((s,x)=>s+Math.max(0,-x),0)
  return {bullForce,bearForce,pressure:ratio(bullForce-bearForce,bullForce+bearForce),coverage:1}
}
export interface TickProfileEvidence {
  snapshotId: string
  timeframe: Timeframe
  from: string
  through: string
  binSize: number
  bins: readonly VolumeProfileBin[]
}
export function analyzeTickProfile(snapshot: MarketSnapshot, input: TickProfileEvidence) {
  const from=Date.parse(input.from),through=Date.parse(input.through)
  const bars=snapshot.bars[input.timeframe]
  if(input.snapshotId!==snapshot.id||!Number.isFinite(from)||!Number.isFinite(through)||from>=through||through>Date.parse(snapshot.asOf)||
    !bars.some(b=>Date.parse(b.closeTime)-TIMEFRAME_SECONDS[input.timeframe]*1000===from)||
    !bars.some(b=>Date.parse(b.closeTime)===through)||!Number.isFinite(input.binSize)||input.binSize<=0)throw new Error('invalid tick profile provenance')
  if(input.bins.some(b=>!Number.isFinite(b.price)||b.price<=0||!Number.isSafeInteger(b.tickCount)||b.tickCount<0)||new Set(input.bins.map(b=>b.price)).size!==input.bins.length)throw new Error('invalid tick bins')
  const frame=buildVolumeProfile(input.bins,{binSize:input.binSize})
  if(!frame)return null
  const totalTicks=frame.bins.reduce((s,b)=>s+b.tickCount,0)
  return {...frame,totalTicks,pocShare:frame.bins.find(b=>b.price===frame.poc)!.tickCount/totalTicks,volumeKind:'tick' as const}
}
