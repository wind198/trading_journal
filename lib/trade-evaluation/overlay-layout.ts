import type {WorkspaceAnalysis} from '../market-analysis/workspace'
import type {TradeOptions,TradeOption} from './options'
import type {Timeframe} from '../market-analysis/contracts'
export interface PlottedSetup{option:TradeOption;number:number;failed:boolean;timeframe:Timeframe}
export function setupPane(data:WorkspaceAnalysis,o:TradeOption):Timeframe{
 const bars=data.snapshot.bars.M3.slice(-50)
 const atr=data.indicators.M3.atr.at(-1)
 if(data.report.classifications.M3.dataQuality!=='usable'||!bars.length||atr==null||atr<=0)return 'M15'
 const span=Math.max(...bars.map(b=>b.high))-Math.min(...bars.map(b=>b.low))
 // Fixed snapshot-based threshold: total setup span fits recent local range
 // and neither leg requires more than four M3 ATRs.
 return (o.riskPoints+o.rewardPoints)*data.snapshot.pointSize<=span&&Math.max(o.riskPoints,o.rewardPoints)*data.snapshot.pointSize<=4*atr?'M3':'M15'
}
export function plottedSetups(data:WorkspaceAnalysis,result:TradeOptions):PlottedSetup[]{
 return [...result.options,...result.failedOptions].map((option,i)=>({option,number:i+1,failed:'failureState'in option,timeframe:setupPane(data,option)}))
}
