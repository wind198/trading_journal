import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Candle, MarketSnapshot } from './contracts'
import { calculateFoundation } from './indicators'
import config from '../../ai/trading_knowledge/config/indicators.json' with { type: 'json' }
import { classifyRegime, compareRegimes, inspectRange, selectedTools, EXPERIMENTAL_REGIME_POLICY as p } from './regimes'
import { scanMarket } from './scan'

const bars = (values: number[], step=180): Candle[] => values.map((close,i)=>({
  closeTime:new Date((i+1)*step*1000).toISOString(),open:close-0.0001,high:close+0.0002,low:close-0.0002,close,volume:null
}))
test('stable linear trends classify symmetrically',()=>{
  for(const direction of [1,-1]){
    const data=bars(Array.from({length:160},(_,i)=>1.2+direction*i*0.0002))
    assert.equal(classifyRegime(data,calculateFoundation(data,config)).regime,direction===1?'uptrend':'downtrend')
    assert.equal(classifyRegime(data,calculateFoundation(data,config),p,true).regime,'choppy')
  }
})
test('confirmed repeated range boundaries exclude current breakout',()=>{
  const data=bars(Array.from({length:61},(_,i)=>1.2+Math.cos(i*Math.PI/5)*0.002))
  const r=inspectRange(data,0.001,p)!
  assert.ok(r.validated)
  const altered=[...data.slice(0,-1),{...data.at(-1)!,open:1.22,high:1.23,low:1.21,close:1.22}]
  assert.deepEqual(inspectRange(altered,0.001,p),r)
})
test('short history is provisional choppy; empty history is unknown',()=>{
  const data=bars([1.2,1.2])
  assert.equal(classifyRegime(data,calculateFoundation(data,config)).regime,'choppy')
  assert.equal(classifyRegime([],calculateFoundation([],config)).regime,'unknown')
  assert.ok(classifyRegime(data,calculateFoundation(data,config)).displayRange)
})
test('alignment and dispatch are explicit',()=>{
  assert.equal(compareRegimes('uptrend','downtrend'),'opposed')
  assert.equal(compareRegimes('unknown','ranging'),'unknown')
  assert.equal(compareRegimes('transition','uptrend'),'transition')
  assert.ok(selectedTools('ranging').includes('analyze_range_structure'))
  assert.ok(!selectedTools('ranging').includes('analyze_trend_extension'))
  assert.ok(selectedTools('unknown').includes('analyze_trend_extension'))
})
test('scan preserves both timeframes, policy and evidence',()=>{
  const m3=bars(Array.from({length:800},(_,i)=>1.2+i*0.0002))
  const m15=bars(Array.from({length:160},(_,i)=>1.2-i*0.0002),900)
  const s:MarketSnapshot={id:'fixture',asOf:m3.at(-1)!.closeTime,symbol:'EURUSD',source:'fixture',pointSize:0.00001,volumeKind:'unknown',bars:{M3:m3,M15:m15}}
  const report=scanMarket(s)
  assert.equal(report.status,'experimental')
  assert.equal(report.alignment,'opposed')
  assert.ok(report.results.every(r=>r.evidence.every(e=>e.snapshotId===s.id)))
  assert.ok(report.results.some(r=>r.toolId==='analyze_timeframe_alignment'))
  assert.deepEqual(scanMarket(s),report)
})

test('adequate non-directional history defaults to choppy, even without validated boundaries',()=>{
  const data=bars(Array.from({length:160},(_,i)=>1.2+Math.sin(i*1.7)*0.0003))
  const f=calculateFoundation(data,config)
  const c=classifyRegime(data,{...f,dmi:{...f.dmi,adx:f.dmi.adx.map(()=>10)}})
  assert.equal(c.regime,'choppy')
  assert.ok(c.range)
  assert.notEqual(c.boundaryConfidence,'unavailable')
})
test('breakout is a secondary state, not a regime',()=>{
  const data=bars(Array.from({length:160},(_,i)=>1.2+Math.cos(i*Math.PI/5)*0.002))
  const last={...data.at(-1)!,open:1.21,high:1.211,low:1.209,close:1.21}
  const altered=[...data.slice(0,-1),last]
  const c=classifyRegime(altered,calculateFoundation(altered,config))
  assert.equal(c.state,'breakout_candidate')
  assert.ok(['choppy','uptrend','downtrend'].includes(c.regime))
})

test('old cadence gap does not suppress a usable recent M3 regime',()=>{
 const m3=bars(Array.from({length:160},(_,i)=>1.2+i*0.0002)).map((b,i)=>({...b,closeTime:new Date(Date.parse(b.closeTime)+(i>=2?180000:0)).toISOString()}))
 const s:MarketSnapshot={id:'gap',asOf:m3.at(-1)!.closeTime,symbol:'EURUSD',source:'fixture',pointSize:0.00001,volumeKind:'unknown',bars:{M3:m3,M15:[]}}
 const report=scanMarket(s)
 assert.equal(report.classifications.M3.dataQuality,'usable')
 assert.equal(report.regimes.M3,'uptrend')
 assert.ok(report.limitations.some(l=>l.includes('cadence gaps')))
})
test('stale or recent-gap bars retain provisional regime and visible bounds',()=>{
 const m3=bars(Array.from({length:60},(_,i)=>1.2+Math.sin(i)*0.0002))
 const s:MarketSnapshot={id:'stale',asOf:new Date(Date.parse(m3.at(-1)!.closeTime)+180000).toISOString(),symbol:'EURUSD',source:'fixture',pointSize:0.00001,volumeKind:'unknown',bars:{M3:m3,M15:[]}}
 const report=scanMarket(s)
 assert.equal(report.regimes.M3,'choppy');assert.equal(report.classifications.M3.dataQuality,'stale')
 assert.ok(report.classifications.M3.displayRange)
})
