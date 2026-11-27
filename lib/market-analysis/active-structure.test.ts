import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Candle } from './contracts'
import { inspectActiveStructure, structuralPriceSpace } from './active-structure'
const bars=(values:number[]):Candle[]=>values.map((close,i)=>({closeTime:new Date((i+1)*180000).toISOString(),open:close,high:close+0.0001,low:close-0.0001,close,volume:null}))
const series=[1.2,1.201,1.202,1.201,1.2,1.199,1.198,1.199,1.2,1.201,1.202,1.201,1.2,1.199,1.198,1.199,1.2,1.201]
test('repeated confirmed pivots form bounded zones',()=>{
 const s=inspectActiveStructure(bars(series),0.001,'long')!
 assert.equal(s.zones.length,2)
 assert.ok(s.zones.every(z=>z.tests===2))
 const space=structuralPriceSpace(s,1.2,'long',1.203)
 assert.equal(space.stop?.side,'support');assert.equal(space.target?.side,'resistance');assert.equal(space.obstacles.length,1)
})
test('close through a zone removes it without flipping role',()=>{
 const s=inspectActiveStructure(bars([...series,1.204]),0.001,'long')!
 assert.ok(!s.zones.some(z=>z.side==='resistance'))
})
test('root is provisional and is removed if subsequent price violates it',()=>{
 const s=inspectActiveStructure(bars(series),0.001,'long')!
 assert.ok(s.correction?.recovered)
 assert.equal(inspectActiveStructure(bars([...series,1.197]),0.001,'long')!.correction,null)
})
test('unconfirmed pivot and missing ATR are withheld',()=>{
 assert.equal(inspectActiveStructure(bars(series),null,'long'),null)
 const s=inspectActiveStructure(bars(series.slice(0,11)),0.001,'long')!
 assert.ok(!s.zones.some(z=>z.side==='resistance'))
})
