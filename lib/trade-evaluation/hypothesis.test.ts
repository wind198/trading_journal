import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHypothesis, setTradeLevel, setTradeDirection, rebindSnapshot, evaluateGeometry, normalizePrice } from './hypothesis'
const point = 0.00001
const base = () => createHypothesis('h','s')
test('entry selection rounds to point and records source timeframe',()=>{
  const h=setTradeLevel(base(),'entryPrice',1.152004,point,'M15')
  assert.equal(h.entryPrice,1.152);assert.equal(h.entryTimeframe,'M15');assert.equal(h.revision,1)
  assert.equal(setTradeLevel(h,'entryPrice',1.152,point,'M15'),h)
  assert.equal(evaluateGeometry(h,point).mode,'exploratory')
})
test('long and short geometry is symmetric',()=>{
  for(const direction of ['long','short'] as const){
    let h=setTradeDirection(base(),direction)
    h=setTradeLevel(h,'entryPrice',1.152,point)
    h=setTradeLevel(h,'stopLossPrice',direction==='long'?1.1515:1.1525,point)
    h=setTradeLevel(h,'takeProfitPrice',direction==='long'?1.153:1.151,point)
    const r=evaluateGeometry(h,point)
    assert.equal(r.mode,'complete');assert.equal(r.riskPoints,50);assert.equal(r.rewardPoints,100);assert.equal(r.grossRewardRisk,2)
    const reversed=setTradeDirection(h,direction==='long'?'short':'long')
    assert.equal(reversed.stopLossPrice,h.stopLossPrice);assert.equal(evaluateGeometry(reversed,point).mode,'invalid')
  }
})
test('invalid prices do not alter hypothesis; missing stop/target remain missing',()=>{
  const h=base()
  assert.equal(setTradeLevel(h,'entryPrice',NaN,point),h)
  assert.equal(normalizePrice(-1,point),null)
  assert.equal(evaluateGeometry(h,point).mode,'incomplete')
})
test('new snapshot and clearing levels invalidate prior revision',()=>{
  const h=setTradeLevel(base(),'entryPrice',1.1,point)
  const next=rebindSnapshot(h,'s2')
  assert.equal(next.entryPrice,h.entryPrice);assert.equal(next.revision,h.revision+1)
  assert.equal(setTradeLevel(next,'entryPrice',null,point).entryPrice,null)
})
