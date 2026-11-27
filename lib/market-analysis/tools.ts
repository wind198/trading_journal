import type { AnalysisResult, EvidenceReference, MarketSnapshot, NumericalFeature, Timeframe } from './contracts'
import { analyzeFoundation } from './foundation'
import { forceSeries, summarizeForce } from './adapters'
import { observedRange } from './structure'
import { ratio, percentile } from './indicators'

type FeatureInput = [number|null,string,number]
const last=(s:readonly (number|null)[])=>s[s.length-1]??null
const diff=(a:number|null,b:number|null)=>a===null||b===null?null:a-b
export interface ToolWindows {
  force: number
  range: number
  percentile: number
}
export function runNumericalTools(snapshot: MarketSnapshot, windows: ToolWindows) {
  for(const n of Object.values(windows))if(!Number.isSafeInteger(n)||n<2||n>10000)throw new RangeError('invalid analytical window')
  const foundation=analyzeFoundation(snapshot)
  const results: AnalysisResult[]=[]
  for(const tf of ['M3','M15'] as const){
    const bars=snapshot.bars[tf],f=foundation.timeframes[tf],close=bars[bars.length-1]?.close??null,a=last(f.atr)
    const emit=(toolId:string, inputs:Record<string,FeatureInput>,limitations:string[]=[])=>{
      const evidence:EvidenceReference[]=bars.length?[{id:snapshot.id+':'+tf+':'+toolId,snapshotId:snapshot.id,timeframe:tf,from:bars[0].closeTime,through:bars[bars.length-1].closeTime,calculationId:toolId,calculationVersion:'1',configVersion:foundation.configVersion}]:[]
      const features:Record<string,NumericalFeature>={}
      for(const [key,[value,unit,lookbackBars]] of Object.entries(inputs))features[key]={value,unit,lookbackBars,evidenceIds:evidence.map(e=>e.id)}
      results.push({toolId,version:'1',timeframe:tf,asOf:snapshot.asOf,status:Object.values(features).some(v=>v.value===null)?'insufficient_data':'ok',features,evidence,limitations:[...foundation.limitations,...limitations]})
    }
    const history=(s:readonly(number|null)[])=>s.length>windows.percentile?s.slice(-windows.percentile-1,-1):[]
    emit('analyze_volatility',{atr:[a,'price',14],atrPoints:[ratio(a,snapshot.pointSize),'points',14],atrPercentile:[percentile(a,history(f.atr)),'percentile',windows.percentile]})
    const reg=f.regression[0]
    emit('analyze_trend_strength',{adx:[last(f.dmi.adx),'score',14],diSpread:[diff(last(f.dmi.plusDI),last(f.dmi.minusDI)),'score',14],efficiency:[last(f.efficiencyRatio),'ratio',20],slopeAtr:[ratio(last(reg.slope),a),'ATR/bar',reg.period],rSquared:[last(reg.rSquared),'ratio',reg.period]})
    const k=last(f.ichimoku.kijun),sa=last(f.ichimoku.alignedA),sb=last(f.ichimoku.alignedB)
    const cloudDistance=close===null||sa===null||sb===null?null:close>Math.max(sa,sb)?close-Math.max(sa,sb):close<Math.min(sa,sb)?close-Math.min(sa,sb):0
    const displacement=f.ichimoku.kijun.map((v,i)=>ratio(diff(bars[i].close,v),f.atr[i]))
    emit('analyze_trend_extension',{kijunDistance:[ratio(diff(close,k),a),'ATR',26],cloudDistance:[ratio(cloudDistance,a),'ATR',78],extensionPercentile:[percentile(last(displacement.map(v=>v===null?null:Math.abs(v))),history(displacement.map(v=>v===null?null:Math.abs(v)))),'percentile',windows.percentile]})
    const range=observedRange(bars,windows.range)
    emit('analyze_range_position',{observedUpper:[range?.upper??null,'price',windows.range],observedLower:[range?.lower??null,'price',windows.range],position:[range?ratio(diff(close,range.lower),range.upper-range.lower):null,'ratio',windows.range],percentB:[last(f.bollinger.percentB),'ratio',20],bandwidth:[last(f.bollinger.bandwidth),'ratio',20]},['Historical extrema are not validated range boundaries.'])
    const force=summarizeForce(forceSeries(bars,tf),windows.force)
    emit('analyze_momentum',{bullForce:[force.bullForce,'score sum',windows.force],bearForce:[force.bearForce,'score sum',windows.force],pressure:[force.pressure,'ratio',windows.force],coverage:[force.coverage,'ratio',windows.force]})
  }
  return {snapshotId:snapshot.id,configVersion:foundation.configVersion,windows:{...windows},regimes:{M3:'unknown',M15:'unknown'} as const,results,limitations:[...foundation.limitations,'Regime policy is uncalibrated; no classification or risk conclusion.']}
}
