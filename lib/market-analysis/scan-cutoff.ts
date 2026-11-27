import { TIMEFRAME_SECONDS } from './snapshot'
const BLOCK_MS=TIMEFRAME_SECONDS.M15*1000
/** A historical point denotes the CLOSE of a completed M15 candle, in UTC. */
export function resolveScanCutoff(value:unknown,now:number):number{
 if(!Number.isSafeInteger(now)||now<=0)throw new Error('Invalid clock')
 if(value===undefined)return now
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))throw new Error('Expected UTC ISO timestamp')
 const ms=Date.parse(value)
 if(!Number.isSafeInteger(ms)||ms<=0||new Date(ms).toISOString()!==value||ms%BLOCK_MS!==0||ms>Math.floor(now/BLOCK_MS)*BLOCK_MS)throw new Error('Select a completed M15 block')
 return ms
}
export function m15CloseFromLocalInput(value:string):string|null{
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null
 const ms=Date.parse(value)
 if(!Number.isFinite(ms)||ms<=0)return null
 return new Date(Math.floor(ms/BLOCK_MS)*BLOCK_MS).toISOString()
}
export function localDateTimeInput(ms:number):string{
 const d=new Date(ms)
 return new Date(ms-d.getTimezoneOffset()*60000).toISOString().slice(0,16)
}
