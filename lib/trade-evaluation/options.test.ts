import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createHypothesis } from './hypothesis'
import { pairReferences, generateTradeOptions } from './options'
import type { StructuralReference, StrategyAssessment } from './strategies'
import { buildWorkspaceAnalysis } from '../market-analysis/workspace'
const point=0.00001
const h=(direction:'long'|'short'='long')=>({...createHypothesis('h','s',direction),entryPrice:1.2})
const ref=(kind:'stop'|'target',price:number,source:StructuralReference['source'],timeframe:'M3'|'M15'='M15'):StructuralReference=>({kind,price,source,timeframe,points:0,atrDistance:null,evidenceIds:['fixture'],from:null,through:null})
const assess=(references:StructuralReference[],strategy:StrategyAssessment['strategy']='continuation',timeframe:'M3'|'M15'='M15'):StrategyAssessment=>({strategy,timeframe,references,metrics:{atr:0.0002},warnings:[],limitations:[],feasibleWithinReferences:null})
test('pairs are buffered beyond stop structure and before target in both directions',()=>{
 for(const d of ['long','short'] as const){
   const sign=d==='long'?1:-1
   const s=1.2-sign*0.0004,t=1.2+sign*0.0008
   const r=pairReferences(h(d),point,[assess([ref('stop',s,'active zone outer edge'),ref('target',t,'active zone near edge')])],'continuation')
   assert.equal(r.pairs.length,1)
   const p=r.pairs[0]
   assert.equal(p.riskPoints,43);assert.equal(p.rewardPoints,79)
   assert.ok((s-p.stopLossPrice)*sign>0);assert.ok((t-p.takeProfitPrice)*sign>0)
 }
})
test('no artificial widening or target extension to satisfy hard limits',()=>{
 const r=pairReferences(h(),point,[assess([ref('stop',1.1999,'active zone outer edge'),ref('target',1.2002,'active zone near edge')])],'continuation')
 assert.equal(r.pairs.length,0);assert.equal(r.rejected,1)
 assert.equal(r.failedPairs.length,1)
 assert.ok(r.failedPairs[0].riskPoints<30)
 assert.ok(r.failedPairs[0].rewardPoints<30)
})
test('no cross-timeframe pairing or standalone countertrend exits for continuation',()=>{
 const r=pairReferences(h(),point,[assess([ref('stop',1.1996,'active zone outer edge')]),assess([ref('target',1.201,'active zone near edge','M3')],'correction_entry','M3'),assess([ref('stop',1.1996,'active zone outer edge','M3'),ref('target',1.201,'equilibrium','M3')],'countertrend','M3')],'continuation')
 assert.equal(r.pairs.length,0)
})
test('range options use validated boundaries only and deduplicate',()=>{
 const refs=[ref('stop',1.1996,'validated range boundary'),ref('target',1.2008,'validated range boundary'),ref('target',1.2015,'active zone near edge')]
 const r=pairReferences(h(),point,[assess(refs,'range'),assess(refs,'range')],'range')
 assert.equal(r.pairs.length,1);assert.equal(r.pairs[0].targetReference.source,'validated range boundary')
})
test('historical pivot alone cannot supply a stop; transition has no candidates',()=>{
 const refs=[ref('stop',1.1995,'confirmed pivot'),ref('target',1.201,'confirmed pivot')]
 assert.equal(pairReferences(h(),point,[assess(refs)],'continuation').pairs.length,0)
 assert.equal(pairReferences(h(),point,[assess(refs,'transition')],'transition').pairs.length,0)
})
test('empty market data withholds options without mutating hypothesis',()=>{
 const data=buildWorkspaceAnalysis({id:'s',symbol:'EURUSD',asOf:'2026-01-01T00:00:00Z',source:'fixture',pointSize:point,volumeKind:'unknown',bars:{M3:[],M15:[]}})
 const input=h()
 const r=generateTradeOptions(data,input)
 assert.equal(r.status,'context_unresolved');assert.equal(r.options.length,0);assert.equal(input.stopLossPrice,null)
})

test('provisional range boundaries support conditional pairs without relaxing hard limits',()=>{
 const refs=[ref('stop',1.1996,'provisional range boundary'),ref('target',1.2008,'provisional range boundary')]
 const result=pairReferences(h(),point,[assess(refs,'range')],'range')
 assert.equal(result.pairs.length,1)
 assert.ok(result.pairs[0].grossRewardRisk>=1.5)
 const narrow=[refs[0],ref('target',1.2002,'provisional range boundary')]
 assert.equal(pairReferences(h(),point,[assess(narrow,'range')],'range').pairs.length,0)
})

test('nested range pairs do not mix inner and outer boundaries',()=>{
 const refs:StructuralReference[]=[
 {...ref('stop',1.1996,'provisional range boundary'),rangeId:'inner'},
 {...ref('target',1.2008,'provisional range boundary'),rangeId:'inner'},
 {...ref('stop',1.199,'validated range boundary'),rangeId:'outer'},
 {...ref('target',1.202,'validated range boundary'),rangeId:'outer'}]
 const result=pairReferences(h(),point,[assess(refs,'range')],'range')
 assert.equal(result.pairs.length,2)
 assert.ok(result.pairs.every(p=>p.stopReference.rangeId===p.targetReference.rangeId))
})

