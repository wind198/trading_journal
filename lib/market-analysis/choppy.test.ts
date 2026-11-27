import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Candle } from './contracts'
import { inspectRange, EXPERIMENTAL_REGIME_POLICY as p } from './regimes'
import { inspectChoppyRanges } from './choppy'
const bars=(values:number[]):Candle[]=>values.map((close,i)=>({closeTime:new Date((i+1)*180000).toISOString(),open:close,high:close+0.0001,low:close-0.0001,close,volume:null}))
const values=[...Array.from({length:30},(_,i)=>1.2+Math.cos(i*Math.PI/5)*0.003),...Array.from({length:21},(_,i)=>1.2+Math.cos(i*Math.PI/5)*0.0008)]
test('nested range excludes current candle and measures penetration separately',()=>{
 const data=bars(values),atr=0.001,outer=inspectRange(data,atr,p)!
 const ranges=inspectChoppyRanges(data,atr,outer)!
 assert.ok(ranges.inner)
 assert.equal(ranges.subtype,'nested_consolidation_candidate')
 const last={...data.at(-1)!,high:1.204,close:1.204,open:1.204,low:1.203}
 const changed=[...data.slice(0,-1),last]
 const next=inspectChoppyRanges(changed,atr,inspectRange(changed,atr,p))!
 assert.equal(next.outer.upper,ranges.outer.upper)
 assert.equal(next.inner?.upper,ranges.inner?.upper)
 assert.ok(next.outer.upperPenetrationAtr>0)
 assert.equal(next.subtype,'breakout_candidate')
})
test('insufficient ATR or missing outer boundaries withhold nesting',()=>{
 const data=bars(values)
 assert.equal(inspectChoppyRanges(data,null,inspectRange(data,0.001,p)),null)
 assert.equal(inspectChoppyRanges(data,0.001,null),null)
})
