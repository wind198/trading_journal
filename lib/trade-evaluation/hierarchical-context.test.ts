import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyPhase, observePhase, type PhaseObservation } from '../market-analysis/phase'
import { resolveTradeContext } from './hierarchical-context'
import { buildWorkspaceAnalysis } from '../market-analysis/workspace'
import { createHypothesis, setTradeLevel } from './hypothesis'
import { evaluateTrade } from './evaluator'
const p=(timeframe:PhaseObservation['timeframe'],regime:PhaseObservation['regime'],phase:PhaseObservation['phase']='expansion'):PhaseObservation=>({timeframe,regime,phase,reason:'fixture',metrics:{displacementAtr:2,kijunExtensionAtr:2,adxChange:0,efficiency:0.7},evidenceIds:[],from:null,through:null,policyVersion:'fixture'})
test('phase direction symmetry and exhaustion is only a candidate',()=>{
  for(const s of [1,-1]){
    const r=s===1?'uptrend':'downtrend'
    assert.equal(classifyPhase(r,{displacementAtr:2*s,kijunExtensionAtr:2*s,adxChange:1,efficiency:0.7}).phase,'expansion')
    assert.equal(classifyPhase(r,{displacementAtr:-s,kijunExtensionAtr:s,adxChange:0,efficiency:0.7}).phase,'correction_candidate')
    assert.equal(classifyPhase(r,{displacementAtr:0.2*s,kijunExtensionAtr:3*s,adxChange:-6,efficiency:0.2}).phase,'exhaustion_candidate')
  }
})
test('hierarchy distinguishes correction entry from local countertrend',()=>{
  const m15=p('M15','uptrend'),m3=p('M3','downtrend')
  assert.equal(resolveTradeContext(m15,m3,'long').kind,'potential_correction_entry')
  assert.equal(resolveTradeContext(m15,m3,'short').kind,'countertrend_correction_trade')
  assert.equal(resolveTradeContext(m15,p('M3','uptrend'),'long').kind,'aligned_continuation')
  assert.equal(resolveTradeContext(p('M15','downtrend'),p('M3','uptrend'),'short').kind,'potential_correction_entry')
})
test('range and transition ambiguity remain explicit',()=>{
  assert.equal(resolveTradeContext(p('M15','ranging','consolidation'),p('M3','uptrend'),'long').kind,'range_breakout_uncertain')
  assert.equal(resolveTradeContext(p('M15','uptrend'),p('M3','transition','transition'),'long').kind,'transition_uncertain')
  assert.equal(resolveTradeContext(p('M15','uptrend'),p('M3','uptrend','unknown'),'long').kind,'context_unknown')
})
test('empty snapshot is unknown; policy still blocks short distances',()=>{
  const data=buildWorkspaceAnalysis({id:'s',symbol:'EURUSD',asOf:'2026-01-01T00:00:00Z',source:'fixture',pointSize:0.00001,volumeKind:'unknown',bars:{M3:[],M15:[]}})
  assert.equal(observePhase(data,'M3').phase,'unknown')
  let h=setTradeLevel(createHypothesis('h','s'),'entryPrice',1.2,0.00001)
  h=setTradeLevel(h,'stopLossPrice',1.1999,0.00001)
  assert.equal(evaluateTrade(data,h).state,'BLOCKED')
})
