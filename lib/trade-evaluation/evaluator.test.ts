import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHypothesis, setTradeLevel, setTradeDirection } from './hypothesis'
import { evaluateHardPolicy, minimumTargetPoints } from './policy'
import { resolveStrategy } from './context'
import { evaluateStrategy } from './strategies'
import type { EvaluationContext } from './context'
import { evaluateTrade } from './evaluator'
import { buildWorkspaceAnalysis } from '../market-analysis/workspace'

const point=0.00001
function hypothesis(stop:number|null,target:number|null,direction:'long'|'short'='long'){
  let h=setTradeDirection(createHypothesis('h','s'),direction)
  h=setTradeLevel(h,'entryPrice',1.2,point)
  h=setTradeLevel(h,'stopLossPrice',stop,point)
  return setTradeLevel(h,'takeProfitPrice',target,point)
}
test('hard limits apply symmetrically, exact boundary and RR',()=>{
  for(const d of ['long','short'] as const){
    const s=d==='long'?1:-1
    const valid=evaluateHardPolicy(hypothesis(1.2-s*30*point,1.2+s*45*point,d),point)
    assert.ok(!valid.warnings.some(w=>w.severity==='block'))
    assert.equal(valid.minimumTargetPoints,45)
    const bad=evaluateHardPolicy(hypothesis(1.2-s*29*point,1.2+s*29*point,d),point)
    assert.deepEqual(bad.warnings.filter(w=>w.severity==='block').map(w=>w.code),['SL_TOO_CLOSE','TP_TOO_CLOSE','RR_INSUFFICIENT'])
  }
  assert.equal(minimumTargetPoints(31),47)
})
test('missing levels are exploratory, not blocked',()=>{
  assert.equal(evaluateHardPolicy(hypothesis(null,null),point).geometry.mode,'exploratory')
  assert.equal(evaluateHardPolicy(hypothesis(null,null),point).warnings.length,0)
})
test('strategy selection follows regime and direction',()=>{
  assert.equal(resolveStrategy('uptrend','long'),'continuation')
  assert.equal(resolveStrategy('uptrend','short'),'countertrend')
  assert.equal(resolveStrategy('downtrend','short'),'continuation')
  assert.equal(resolveStrategy('downtrend','long'),'countertrend')
  assert.equal(resolveStrategy('ranging','short'),'range')
  assert.equal(resolveStrategy('transition','long'),'transition')
  assert.equal(resolveStrategy('unknown','long'),'unknown')
})
function context(strategy:EvaluationContext['strategy'],h=hypothesis(1.1997,1.2006)):EvaluationContext{
  return {h,timeframe:'M3',regime:strategy==='range'?'ranging':strategy==='transition'?'transition':strategy==='unknown'?'unknown':'uptrend',strategy,entry:1.2,sign:1,atr:0.0002,kijun:1.199,pressure:-0.8,stale:false,range:null,stopPivot:null,targetPivot:null,evidenceIds:['fixture'],pointSize:point,from:null,through:null}
}
test('extension is evaluated differently for continuation and countertrend',()=>{
  assert.ok(evaluateStrategy(context('continuation')).warnings.some(w=>w.code==='ENTRY_OVEREXTENDED'))
  assert.ok(evaluateStrategy(context('countertrend')).warnings.some(w=>w.code==='COUNTERTREND_NOT_EXTENDED'))
  assert.ok(!evaluateStrategy(context('countertrend')).warnings.some(w=>w.code==='ENTRY_OVEREXTENDED'))
})
test('validated range can be infeasible without inventing prices',()=>{
  const c=context('range',hypothesis(null,null))
  c.range={lower:1.1994,upper:1.2007,from:'a',through:'b',upperTests:2,lowerTests:2,widthAtr:6.5,tolerance:0.0001,validated:true}
  const r=evaluateStrategy(c)
  assert.equal(r.feasibleWithinReferences,false)
  assert.ok(r.warnings.some(w=>w.code==='STRUCTURAL_SPACE_INFEASIBLE'))
  assert.equal(r.references.length,2)
  assert.equal(c.h.stopLossPrice,null)
})
test('transition and unknown do not fabricate reference prices',()=>{
  for(const strategy of ['transition','unknown'] as const)assert.equal(evaluateStrategy(context(strategy)).references.length,0)
})
test('snapshot mismatch and missing data remain incomplete; hard block wins',()=>{
  const data=buildWorkspaceAnalysis({id:'s',symbol:'EURUSD',asOf:'2026-01-01T00:00:00Z',source:'fixture',pointSize:point,volumeKind:'unknown',bars:{M3:[],M15:[]}})
  assert.equal(evaluateTrade(data,hypothesis(null,null)).state,'INCOMPLETE')
  assert.equal(evaluateTrade(data,hypothesis(1.1999,1.2001)).state,'BLOCKED')
  assert.equal(evaluateTrade(data,{...hypothesis(1.1995,1.201),snapshotId:'other'}).state,'INCOMPLETE')
})

test('choppy provisional boundaries are evaluable and carry uncertainty',()=>{
 const c=context('range',hypothesis(null,null))
 c.regime='choppy'
 c.range={lower:1.1996,upper:1.2008,from:'a',through:'b',upperTests:1,lowerTests:1,widthAtr:6,tolerance:0.0001,validated:false}
 const a=evaluateStrategy(c)
 assert.equal(a.references.length,2)
 assert.ok(a.references.every(r=>r.source==='provisional range boundary'))
 assert.ok(a.warnings.some(w=>w.code==='PROVISIONAL_RANGE_BOUNDARY'))
 assert.equal(a.feasibleWithinReferences,null)
})

test('maximum gross reward/risk is inclusive at 3 and blocks above it in either direction',()=>{
 for(const d of ['long','short'] as const){
  const s=d==='long'?1:-1
  assert.ok(!evaluateHardPolicy(hypothesis(1.2-s*30*point,1.2+s*90*point,d),point).warnings.some(w=>w.code==='RR_EXCESSIVE'))
  assert.ok(evaluateHardPolicy(hypothesis(1.2-s*30*point,1.2+s*91*point,d),point).warnings.some(w=>w.code==='RR_EXCESSIVE'&&w.severity==='block'))
 }
})
