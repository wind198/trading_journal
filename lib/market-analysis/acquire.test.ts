import assert from 'node:assert/strict'
import { test } from 'node:test'
import { completedBars, snapshotFromProvider } from './acquire'
const bar=(time:number)=>({time,open:1.1,high:1.2,low:1,close:1.15})
test('provider open timestamps map to closed analysis bars',()=>{
  const result=completedBars([bar(0),bar(180),bar(360)],'M3',360000)
  assert.equal(result.length,2)
  assert.equal(result[0].closeTime,new Date(180000).toISOString())
  assert.equal(result[1].closeTime,new Date(360000).toISOString())
  assert.equal(result[0].volume,null)
})
test('one as-of cutoff for both timeframes',()=>{
  const s=snapshotFromProvider('fixture',1000000,{M3:[bar(720),bar(900)],M15:[bar(0),bar(900)]})
  assert.equal(s.bars.M3.length,1);assert.equal(s.bars.M15.length,1)
  assert.equal(s.bars.M3[0].closeTime,s.bars.M15[0].closeTime)
})
test('invalid provider cadence rejected instead of relabeling',()=>{
  assert.throws(()=>snapshotFromProvider('fixture',1000000,{M3:[bar(300)],M15:[]}))
})
