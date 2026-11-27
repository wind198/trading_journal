import type {Candle} from './contracts'
import type {LightweightCandle} from '../ticks/candles'
import {fetchVolumeProfileTimeTickCounts} from '../ticks/volume-profile'
/** Existing RPC counts valid priced tick rows, exclusive upper timestamp. */
export async function attachTickVolume(bars:readonly LightweightCandle[],asOf:number):Promise<Candle[]>{
 if(!bars.length)return []
 const counts=await fetchVolumeProfileTimeTickCounts({symbol:'EURUSD',fromMsc:bars[0].time*1000,toMsc:Math.min(asOf,(bars.at(-1)!.time+180)*1000),intervalSec:180})
 const byTime=new Map(counts.map(b=>[b.time,b.tickCount]))
 return bars.map(b=>({closeTime:new Date((b.time+180)*1000).toISOString(),open:b.open,high:b.high,low:b.low,close:b.close,volume:byTime.get(b.time)??null}))
}
