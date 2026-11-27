import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Candle, MarketSnapshot } from './contracts'
import { atr, bollinger, dmi, efficiencyRatio, ichimokuSeries, percentile, regression, wilder } from './indicators'
import { validateSnapshot } from './snapshot'

function bars(values: number[], step=180): Candle[] {
  return values.map((close,i)=>({closeTime:new Date((i+1)*step*1000).toISOString(),open:close,high:close+1,low:close-1,close,volume:null}))
}
test('Wilder seed and reset',()=>assert.deepEqual(wilder([null,2,4,6,null,3,5],2),[null,null,3,4.5,null,null,4]))
test('ATR uses prior close and full warmup',()=>assert.deepEqual(atr(bars([10,11,15,16]),2),[null,null,3.5,2.75]))
test('DMI trending and mirrored series',()=>{
  const up=dmi(bars([10,11,12,13,14]),2),down=dmi(bars([14,13,12,11,10]),2)
  assert.equal(up.adx[2],null);assert.equal(up.adx[3],100)
  assert.equal(up.plusDI[4],down.minusDI[4]);assert.equal(up.minusDI[4],0)
})
test('ER and regression for linear and flat inputs',()=>{
  assert.equal(efficiencyRatio(bars([10,11,12]),2)[2],1)
  assert.equal(efficiencyRatio(bars([10,10,10]),2)[2],null)
  assert.equal(regression(bars([10,12,14]),3).slope[2],2)
  assert.equal(regression(bars([10,12,14]),3).rSquared[2],1)
  assert.equal(regression(bars([10,10,10]),3).rSquared[2],null)
})
test('Bollinger population variance and zero width',()=>{
  const r=bollinger(bars([10,12]),2,2)
  assert.deepEqual(r.upper,[null,13]);assert.deepEqual(r.lower,[null,9])
  assert.equal(r.percentB[1],0.75)
  assert.equal(bollinger(bars([10,10]),2,2).percentB[1],null)
})
test('Ichimoku aligned cloud does not read future bars',()=>{
  const cfg={tenkan:2,kijun:3,spanB:4,displacement:2},data=bars([10,11,12,13,14,15,16])
  const result=ichimokuSeries(data,cfg)
  assert.equal(result.alignedB[4],null);assert.equal(result.alignedB[5],11.5)
  const prefix=ichimokuSeries(data.slice(0,6),cfg)
  for(const key of Object.keys(prefix) as (keyof typeof prefix)[])assert.deepEqual(prefix[key],result[key].slice(0,6))
})
test('percentile ties and missing data',()=>{
  assert.equal(percentile(2,[1,2,3]),50);assert.equal(percentile(2,[1,null]),null)
})
test('snapshot rejects future or duplicate bars and reports gaps',()=>{
  const data=bars([10,11,12])
  const s:MarketSnapshot={id:'fixture',symbol:'EURUSD',asOf:data[2].closeTime,source:'fixture',pointSize:0.00001,volumeKind:'unknown',bars:{M3:data,M15:[]}}
  assert.ok(validateSnapshot(s).some(x=>x.includes('no completed')))
  assert.throws(()=>validateSnapshot({...s,bars:{M3:[data[0],data[0]],M15:[]}}))
  assert.throws(()=>validateSnapshot({...s,asOf:data[0].closeTime}))
  assert.ok(validateSnapshot({...s,bars:{M3:[data[0],data[2]],M15:[]}}).some(x=>x.includes('cadence gaps')))
})
test('invalid periods rejected',()=>assert.throws(()=>atr(bars([10]),0)))
