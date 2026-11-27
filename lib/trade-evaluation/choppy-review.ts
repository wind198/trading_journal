import type { EvaluationContext } from './context'
import type { StrategyAssessment, StructuralReference } from './strategies'
import type { ChoppyRanges } from '../market-analysis/choppy'
import { PENETRATION_WARNING_ATR } from '../market-analysis/choppy'
import type { ReviewWarning } from './policy'

export function enrichChoppy(c:EvaluationContext,a:StrategyAssessment,ranges:ChoppyRanges|null):StrategyAssessment{
  if(a.strategy!=='range'||!ranges||c.stale||c.atr===null||c.atr<=0)return a
  const atr=c.atr
  const references=a.references.map(r=>r.source==='validated range boundary'||r.source==='provisional range boundary'?{...r,rangeId:'outer' as const}:r)
  const warnings=[...a.warnings],metrics={...a.metrics}
  const warn=(code:ReviewWarning['code'],dimension:ReviewWarning['dimension'],message:string)=>warnings.push({code,dimension,message,severity:'warning',timeframe:c.timeframe,evidenceIds:c.evidenceIds})
  for(const r of [ranges.outer,ranges.inner]){
    if(!r)continue
    metrics[r.id+'UpperPenetrationAtr']=r.upperPenetrationAtr
    metrics[r.id+'LowerPenetrationAtr']=r.lowerPenetrationAtr
    metrics[r.id+'CloseOutside']=Number(r.closeOutside)
    if(Math.max(r.upperPenetrationAtr,r.lowerPenetrationAtr)>=PENETRATION_WARNING_ATR)
      warn('RANGE_BOUNDARY_PENETRATION','entry',r.id+' historical boundary penetrated by latest candle; containment uncertain.')
  }
  const inner=ranges.inner
  if(inner){
    metrics.innerWidthAtr=inner.widthAtr
    metrics.innerPosition=(c.entry-inner.lower)/(inner.upper-inner.lower)
    if(!inner.closeOutside&&!ranges.outer.closeOutside&&c.entry>inner.lower&&c.entry<inner.upper){
      for(const kind of ['stop','target'] as const){
        const price=(kind==='stop')===(c.sign===1)?inner.lower:inner.upper
        const distance=(price-c.entry)*c.sign*(kind==='stop'?-1:1)
        const r:StructuralReference={kind,price,points:distance/c.pointSize,atrDistance:distance/atr,timeframe:c.timeframe,source:inner.validated?'validated range boundary':'provisional range boundary',rangeId:'inner',evidenceIds:c.evidenceIds,from:inner.from,through:inner.through}
        references.push(r)
      }
      if(!inner.validated)warn('INNER_RANGE_PROVISIONAL','risk','Nested range is an observed candidate, not a validated structural channel.')
      if(c.h.stopLossPrice!==null&&(c.h.stopLossPrice-(c.sign===1?inner.lower:inner.upper))*c.sign>=0)
        warn('SL_INNER_RANGE_EXPOSURE','stop','Stop remains inside or at the inner boundary.')
      if(c.h.takeProfitPrice!==null&&(c.h.takeProfitPrice-(c.sign===1?inner.upper:inner.lower))*c.sign>0)
        warn('TP_INNER_RANGE_OBSTACLE','target','Target requires movement beyond the inner boundary.')
    }
  }
  return {...a,choppy:ranges,references,warnings,metrics,limitations:[...a.limitations,'Penetration is latest completed candle versus prior frozen extrema, not a historical penetration probability. Nested range is a shorter-window compression candidate.']}
}
