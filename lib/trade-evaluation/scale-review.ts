import type { WorkspaceAnalysis } from '../market-analysis/workspace'
import type { EvaluationContext } from './context'
import type { StrategyAssessment } from './strategies'
import type { ReviewWarning } from './policy'

export function enrichScaleRisk(data:WorkspaceAnalysis,c:EvaluationContext,a:StrategyAssessment):StrategyAssessment{
 if(c.stale)return a
 const warnings=[...a.warnings],metrics={...a.metrics}
 for(const id of ['extended','structural'] as const){
  const s=data.report.scales[c.timeframe][id],q=s.classification
  const evidenceIds=data.report.results.find(r=>r.timeframe===c.timeframe&&r.toolId==='analyze_scale_'+id)?.evidence.map(e=>e.id)??[]
  if(s.quality!=='usable'||!evidenceIds.length)continue
  const warn=(code:ReviewWarning['code'],dimension:ReviewWarning['dimension'],message:string,anchorPrice?:number)=>warnings.push({code,dimension,message,severity:'warning',timeframe:c.timeframe,evidenceIds,anchorPrice})
  const label=s.multiplier+'× '+id
  const sign=q.regime==='uptrend'?1:q.regime==='downtrend'?-1:0
  metrics[id+'Direction']=sign
  if(sign===-c.sign)warn('SCALE_DIRECTION_CONFLICT','entry',label+' trend opposes the proposed trade.')
  if(sign!==0&&c.regime==='choppy')warn('SCALE_RANGE_TREND_CONTEXT','entry',label+' directional structure coexists with baseline chop; range containment not assured.')
  const f=data.scaleIndicators[c.timeframe][id],atr=f.atr.at(-1)??null,kijun=f.ichimoku.kijun.at(-1)??null
  metrics[id+'Atr']=atr;metrics[id+'KijunDistanceAtr']=atr!==null&&atr>0&&kijun!==null?(c.entry-kijun)*c.sign/atr:null
  const r=q.range
  if(!r||r.upper<=r.lower)continue
  const stop=c.sign===1?r.lower:r.upper,target=c.sign===1?r.upper:r.lower
  metrics[id+'RangePosition']=(c.entry-r.lower)/(r.upper-r.lower)
  metrics[id+'TargetSpacePoints']=Math.max(0,(target-c.entry)*c.sign/c.pointSize)
  if(q.regime==='choppy'&&c.entry>r.lower&&c.entry<r.upper){
   if(c.h.stopLossPrice!==null&&(c.h.stopLossPrice-stop)*c.sign>=0)
    warn('SCALE_STOP_INSIDE_RANGE','stop',label+' stop remains within broader observed range'+(r.validated?'.':' (provisional).'),stop)
   if(c.h.takeProfitPrice!==null&&(c.h.takeProfitPrice-target)*c.sign>0)
    warn('SCALE_TARGET_BEYOND_RANGE','target',label+' target requires exceeding broader range'+(r.validated?'.':' (provisional).'),target)
  }
 }
 return {...a,metrics,warnings,limitations:[...a.limitations,'Larger-scale observations are supplemental, experimental evidence; unavailable profiles do not replace baseline.']}
}
