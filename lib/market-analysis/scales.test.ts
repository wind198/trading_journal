import assert from 'node:assert/strict'
import {test} from 'node:test'
import {scaleConfig,inspectScale} from './scales'
import type {MarketSnapshot,Candle} from './contracts'
import config from '../../ai/trading_knowledge/config/indicators.json' with {type:'json'}
const bars=(n:number):Candle[]=>Array.from({length:n},(_,i)=>{const close=1.2+i*0.0001;return {closeTime:new Date((i+1)*180000).toISOString(),open:close,close,high:close+0.0001,low:close-0.0001,volume:null}})
const snap=(n:number):MarketSnapshot=>{const b=bars(n);return {id:'s',symbol:'EURUSD',asOf:b.at(-1)!.closeTime,source:'fixture',pointSize:0.00001,volumeKind:'unknown',bars:{M3:b,M15:[]}}}
test('baseline stays unchanged, periods expand without reducing any length',()=>{
 assert.deepEqual(scaleConfig('baseline'),{atr:config.atr,adxDmi:config.adxDmi,efficiencyRatio:config.efficiencyRatio,bollinger:config.bollinger,ichimoku:config.ichimoku,regression:config.regression})
 assert.equal(scaleConfig('extended').bollinger.period,40)
 assert.equal(scaleConfig('structural').ichimoku.spanB,208)
 assert.equal(scaleConfig('structural').ichimoku.displacement,104)
})
test('larger profiles require independent warmup and preserve snapshot cutoff',()=>{
 assert.equal(inspectScale(snap(100),'M3','structural').quality,'warming_up')
 const s=snap(800),p=inspectScale(s,'M3','structural')
 assert.equal(p.quality,'usable');assert.equal(p.rangeWindow,200)
 assert.equal(p.classification.regime,'uptrend')
 assert.equal(p.indicators.atr.length,800)
 assert.ok(Date.parse(p.classification.range!.through)<Date.parse(s.asOf))
})
test('larger profile reports recent gaps in its own observation horizon',()=>{
 const s=snap(800)
 const b=s.bars.M3.map((b,i)=>({...b,closeTime:new Date(Date.parse(b.closeTime)+(i>=700?180000:0)).toISOString()}))
 const changed={...s,asOf:b.at(-1)!.closeTime,bars:{...s.bars,M3:b}}
 assert.equal(inspectScale(changed,'M3','structural').quality,'recent_gap')
})
