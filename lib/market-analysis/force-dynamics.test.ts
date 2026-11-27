import assert from 'node:assert/strict'
import {test} from 'node:test'
import {forceWindow,observeForceDynamics} from './force-dynamics'
import type {Candle} from './contracts'
const bars=(n:number):Candle[]=>Array.from({length:n},(_,i)=>({closeTime:new Date((i+1)*180000).toISOString(),open:1.2,close:1.2,high:1.2001,low:1.1999,volume:null}))
test('balance and intensity distinguish weak and strong opposing force',()=>{
 const weak=forceWindow([10,-10,10,-10],4),strong=forceWindow([90,-90,90,-90],4)
 assert.equal(weak.pressure,0);assert.equal(strong.pressure,0)
 assert.equal(weak.intensity,10);assert.equal(strong.intensity,90)
})
test('missing is not zero; zero force has no directional pressure',()=>{
 assert.equal(forceWindow([10,null],2).pressure,null)
 assert.equal(forceWindow([10,null],2).coverage,0.5)
 assert.equal(forceWindow([0,0],2).intensity,0)
 assert.equal(forceWindow([0,0],2).pressure,null)
})
test('growing opposing force is detected symmetrically despite broader equilibrium',()=>{
 for(const sign of [1,-1]){
 const values=[...Array.from({length:100},(_,i)=>i%2?40:-40),...Array(5).fill(-70*sign),...Array(5).fill(80*sign)]
 const d=observeForceDynamics(bars(values.length),values,0.0002)
 assert.equal(d.state,sign===1?'emerging_bull':'emerging_bear')
 assert.equal(d.displacementAtr,0)
 }
})
test('historical intensity uses only earlier windows',()=>{
 const values=[...Array.from({length:140},(_,i)=>i%2?20:-20),...Array.from({length:20},(_,i)=>i%2?90:-90)]
 const d=observeForceDynamics(bars(values.length),values,0.0002)
 assert.equal(d.intensityPercentile,1);assert.equal(d.state,'active_equilibrium')
})
