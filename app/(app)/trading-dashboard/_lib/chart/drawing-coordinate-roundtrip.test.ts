import assert from 'node:assert/strict'
import test from 'node:test'
import type { IChartApi } from 'lightweight-charts'
import { chartXAtTime,timeAtChartX,timeAtLogicalIndex } from './chart-coordinates'

for(const step of [180,300,900]) {
  test('fractional anchors survive projection and inverse mapping at '+step+' seconds',()=>{
    const bars=[0,1,2,3,4].map(i=>({time:1800000000+i*step}))
    const scale={
      timeToCoordinate:(time:number)=>{const i=bars.findIndex(b=>b.time===time);return i<0?null:120+i*16},
      coordinateToLogical:(x:number)=>Math.round((x-120)/16)+50,
      logicalToCoordinate:()=>0,
      coordinateToTime:()=>null,
    }
    const chart={timeScale:()=>scale} as unknown as IChartApi
    for(const x of [96,120,128,151,176,200]){
      const time=timeAtChartX(chart,x,bars)
      assert.notEqual(time,null)
      assert.ok(Math.abs(chartXAtTime(chart,time!,bars)!-x)<1e-6)
    }
    assert.equal(chartXAtTime(chart,0,bars),null)
  })
}
test('temporarily missing chart slots do not pull an anchor to x=0',()=>{
 const bars=[{time:1000},{time:1180},{time:1360}]
 const chart={timeScale:()=>({timeToCoordinate:(t:number)=>t===1000?40:null,logicalToCoordinate:()=>0,coordinateToLogical:()=>0,coordinateToTime:()=>null})} as unknown as IChartApi
 assert.equal(chartXAtTime(chart,1270,bars),null)
 assert.equal(timeAtChartX(chart,60,bars),null)
})
test('negative logical positions extrapolate instead of collapsing to first timestamp',()=>{
 assert.equal(timeAtLogicalIndex(-1.5,[{time:1000},{time:1180}]),730)
})
