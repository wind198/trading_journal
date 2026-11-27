import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Candle, MarketSnapshot } from './contracts'
import { confirmedPivots, observedRange } from './structure'
import { analyzeTickProfile, forceSeries, summarizeForce } from './adapters'
import { runNumericalTools } from './tools'
import { calculateForceScores } from '../market-indicators/force-candles'
import { calculateForceScores as dashboardForce } from '@/app/(app)/trading-dashboard/_lib/overlays/force-candles'

const bars=(values:number[],step=180):Candle[]=>values.map((close,i)=>({closeTime:new Date((i+1)*step*1000).toISOString(),open:close-0.1,high:close+0.2,low:close-0.2,close,volume:null}))
const snapshot=(m3:Candle[]):MarketSnapshot=>({id:'fixture',symbol:'EURUSD',asOf:m3[m3.length-1].closeTime,source:'fixture',volumeKind:'unknown',pointSize:0.00001,bars:{M3:m3,M15:[]}})
test('pivots only appear after right confirmation',()=>{
  const data=bars([2,4,2,3])
  assert.equal(confirmedPivots(data.slice(0,2),1,1).length,0)
  const high=confirmedPivots(data,1,1).find(p=>p.side==='high')!
  assert.equal(high.pivotIndex,1);assert.equal(high.confirmedIndex,2)
  assert.equal(high.confirmedTime,data[2].closeTime)
})
test('range excludes current breakout bar',()=>{
  const data=bars([2,3,2,10]),r=observedRange(data,3)!
  assert.equal(r.upper,3.2);assert.ok(data[3].close>r.upper)
})
test('shared force preserves dashboard function and causal output',()=>{
  assert.equal(calculateForceScores,dashboardForce)
  const data=bars(Array.from({length:120},(_,i)=>2+i/100))
  const series=forceSeries(data,'M3')
  assert.equal(series[99],null);assert.ok(series[100]!>0)
  assert.deepEqual(forceSeries(data.slice(0,110),'M3'),series.slice(0,110))
  assert.equal(summarizeForce(series,10).pressure,1)
  assert.equal(summarizeForce([1,null],2).pressure,null)
})
test('tick profile rejects mismatched provenance and does not use OHLC volume',()=>{
  const s=snapshot(bars([2,3,4])),input={snapshotId:s.id,timeframe:'M3' as const,from:new Date(0).toISOString(),through:s.asOf,binSize:1,bins:[{price:2,tickCount:8},{price:3,tickCount:2}]}
  assert.equal(analyzeTickProfile(s,input)?.poc,2)
  assert.equal(analyzeTickProfile(s,input)?.pocShare,0.8)
  assert.throws(()=>analyzeTickProfile(s,{...input,snapshotId:'other'}))
})
test('tools retain missing values and unknown regime without calibration',()=>{
  const s=snapshot(bars(Array.from({length:120},(_,i)=>2+i/100)))
  const r=runNumericalTools(s,{force:10,range:20,percentile:20})
  assert.equal(r.regimes.M3,'unknown')
  assert.equal(r.results.length,10)
  assert.ok(r.results.filter(x=>x.timeframe==='M15').every(x=>x.status==='insufficient_data'))
  assert.equal(r.results.find(x=>x.toolId==='analyze_momentum'&&x.timeframe==='M3')?.features.pressure.value,1)
})
