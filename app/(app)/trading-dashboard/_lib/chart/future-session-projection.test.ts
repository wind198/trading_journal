import assert from 'node:assert/strict'
import test from 'node:test'
import { projectionIntervalSec, futureBarTimesUntilChartZoneEod, chartCoordinateBars } from './extend-candles-to-chart-eod'
import { chartXAtTime } from './chart-coordinates'
import type { IChartApi } from 'lightweight-charts'
const candles=(interval:number)=>[0,1,2,3].map(i=>({time:3600+i*interval,open:1,high:1,low:1,close:1}))
test('M3 projects the observed 180-second or legacy 300-second cadence',()=>{
  for(const interval of [180,300]){
    const bars=candles(interval),last=bars.at(-1)!.time
    assert.equal(projectionIntervalSec(bars,'3m'),interval)
    assert.deepEqual(futureBarTimesUntilChartZoneEod(bars,'3m',last+interval*4),[last+interval,last+interval*2,last+interval*3])
  }
})
test('M15 remains 900 seconds; sparse M3 history falls back to configured cadence',()=>{
  assert.equal(projectionIntervalSec(candles(900),'15m'),900)
  assert.equal(projectionIntervalSec(candles(900).slice(0,1),'3m'),300)
})
test('rendered whitespace and coordinate bars share exact timestamps',()=>{
  const bars=candles(180),last=bars.at(-1)!.time
  const future=futureBarTimesUntilChartZoneEod(bars,'3m',last+180*6)
  assert.deepEqual(chartCoordinateBars(bars,'3m',future).map(b=>b.time),[...bars.map(b=>b.time),...future])
})
test('off-grid future opening uses actual chart spacing and fractional coordinates',()=>{
  for(const interval of [180,300,900]){
    const bars=candles(interval),last=bars.at(-1)!.time
    const future=futureBarTimesUntilChartZoneEod(bars,interval===900?'15m':'3m',last+interval*5)
    const timeline=chartCoordinateBars(bars,interval===900?'15m':'3m',future)
    const scale={timeToCoordinate:(time:number)=>{const i=timeline.findIndex(b=>b.time===time);return i<0?null:100+i*12},logicalToCoordinate:()=>-999}
    const chart={timeScale:()=>scale} as unknown as IChartApi
    assert.equal(chartXAtTime(chart,last+interval*2.5,timeline),166)
    assert.equal(chartXAtTime(chart,last+interval*2,timeline),160)
  }
})
