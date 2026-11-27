import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createVolumeForceCache,mergeVolumeForce,volumeForceSeries,VWCF_WARMUP} from './volume-weighted-force'
import type {Candle} from './contracts'
const bar=(i:number,volume:number|null=100,down=false):Candle=>({closeTime:new Date((i+1)*180000).toISOString(),open:1.2,high:1.201,low:1.199,close:down?1.1991:1.2009,volume})
const history=Array.from({length:VWCF_WARMUP+3},(_,i)=>bar(i))
test('volume scales magnitude without reversing bearish direction',()=>{
 const low=volumeForceSeries([...history,bar(history.length,20,true)]).at(-1)!
 const high=volumeForceSeries([...history,bar(history.length,200,true)]).at(-1)!
 assert.equal(low.direction,-1);assert.equal(high.direction,-1)
 assert.equal(low.relativeVolume,.2);assert.equal(high.relativeVolume,1)
 assert.ok(high.value!>low.value!);assert.ok(high.value!<=100)
})
test('missing tick counts are not zero and current volume is excluded from baseline',()=>{
 const missing=volumeForceSeries([...history,bar(history.length,null)]).at(-1)!
 assert.equal(missing.value,null)
 const high=volumeForceSeries([...history,bar(history.length,100000)]).at(-1)!
 assert.equal(high.relativeVolume,1)
})
test('incremental correction and append match full recalculation',()=>{
 const cache=createVolumeForceCache(history)
 const changes=[bar(history.length-1,200,true),bar(history.length,50)]
 const next=mergeVolumeForce(cache,changes)
 assert.deepEqual(next.points,volumeForceSeries(next.bars))
 assert.equal(next.points[0],cache.points[0])
})
