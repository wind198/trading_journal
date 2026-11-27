import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHypothesis } from './hypothesis'
import { confirmEntry,changeEntryDirection,refreshEntrySnapshot } from './entry-selection'
const h={...createHypothesis('h','s'),entryPrice:1.2,stopLossPrice:1.1995,takeProfitPrice:1.201}
const draft={snapshotId:'s',hypothesisId:'h',revision:0,price:1.200123,timeframe:'M15' as const}
test('confirmed chart pick snaps price and invalidates preview',()=>{
 const next=confirmEntry(h,draft,0.00001)
 assert.equal(next.entryPrice,1.20012);assert.equal(next.entryTimeframe,'M15');assert.equal(next.stopLossPrice,null);assert.equal(next.takeProfitPrice,null);assert.equal(next.revision,1)
})
test('stale draft cannot overwrite revised hypothesis',()=>{
 assert.equal(confirmEntry(h,{...draft,revision:1},0.00001),h)
 assert.equal(confirmEntry(h,{...draft,snapshotId:'other'},0.00001),h)
 assert.equal(confirmEntry(h,{...draft,hypothesisId:'other'},0.00001),h)
})
test('direction and snapshot changes clear preview without changing entry',()=>{
 for(const next of [changeEntryDirection(h,'short'),refreshEntrySnapshot(h,'s2')]){
  assert.equal(next.entryPrice,h.entryPrice);assert.equal(next.stopLossPrice,null);assert.equal(next.takeProfitPrice,null);assert.equal(next.revision,1)
 }
})
