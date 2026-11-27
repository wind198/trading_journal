import type {OptionPair} from './options'
import policy from '../../ai/trading_knowledge/config/option-policy.json' with {type:'json'}
export function distinctGeometry(a:OptionPair,b:OptionPair){
 const different=(x:number,y:number)=>Number.isFinite(x)&&Number.isFinite(y)&&x>0&&y>0&&Math.max(x,y)-Math.min(x,y)>=Math.min(x,y)*policy.minRelativeDifference-1e-9
 return different(a.riskPoints,b.riskPoints)||different(a.rewardPoints,b.rewardPoints)
}
export function geometryDistance(a:OptionPair,b:OptionPair){
 return Math.hypot(Math.log(a.riskPoints/b.riskPoints),Math.log(a.rewardPoints/b.rewardPoints))
}
export function farthest<T extends OptionPair>(pool:readonly T[],selected:readonly OptionPair[]):T|undefined{
 let best:T|undefined,score=-Infinity
 for(const candidate of pool){
  if(selected.some(s=>!distinctGeometry(s,candidate)))continue
  const distance=selected.length?Math.min(...selected.map(s=>geometryDistance(s,candidate))):0
  if(distance>score){best=candidate;score=distance}
 }
 return best
}
