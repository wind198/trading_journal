import { generateTradeOptions } from './options'
import type { WorkspaceAnalysis } from '../market-analysis/workspace'
import type { TradeHypothesis } from './contracts'
import type { SearchProgress,TradeOptions } from './options'
export type SearchRequest={data:WorkspaceAnalysis;hypothesis:TradeHypothesis}
export type SearchMessage={type:'progress';progress:SearchProgress}|{type:'result';result:TradeOptions}|{type:'error';message:string}
const worker=self as unknown as {onmessage:((event:MessageEvent<SearchRequest>)=>void)|null;postMessage:(m:SearchMessage)=>void}
worker.onmessage=({data:{data,hypothesis}})=>{
 try{
  const result=generateTradeOptions(data,hypothesis,progress=>worker.postMessage({type:'progress',progress}))
  worker.postMessage({type:'result',result})
 }catch{worker.postMessage({type:'error',message:'Structural search failed. Retry.'})}
}
