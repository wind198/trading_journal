import assert from 'node:assert/strict'
import test from 'node:test'
import {normalizeVolumeProfileSettings,volumeProfilePriceGrid} from './volume-profile-settings'
test('invalid settings use defaults',()=>assert.deepEqual(normalizeVolumeProfileSettings({lookback:0,bins:25}),{lookback:96,bins:30}))
test('grid uses only the chosen lookback and resolution',()=>{const candles=[{low:1,high:2},{low:1.1,high:1.104},{low:1.102,high:1.106}];for(const bins of [20,30,40] as const){const g=volumeProfilePriceGrid(candles,{lookback:2,bins})!;assert.equal(g.low,1.1);assert.equal(g.high,1.106);assert.ok(Math.abs(g.binSize-(1.106-1.1)/bins)<1e-12)}})
test('flat range has positive bin width',()=>assert.equal(volumeProfilePriceGrid([{low:1.1,high:1.1}],{lookback:1,bins:40})?.binSize,0.00001))
