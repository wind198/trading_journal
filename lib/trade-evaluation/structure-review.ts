import type { EvaluationContext } from './context'
import type { StrategyAssessment, StructuralReference } from './strategies'
import type { ActiveStructure } from '../market-analysis/active-structure'
import { structuralPriceSpace } from '../market-analysis/active-structure'
import type { ReviewWarning } from './policy'

export function enrichStructure(c:EvaluationContext,a:StrategyAssessment,structure:ActiveStructure|null):StrategyAssessment{
  if(!structure||c.stale||a.strategy==='unknown'||a.strategy==='transition')return a
  const space=structuralPriceSpace(structure,c.entry,c.h.direction,c.h.takeProfitPrice)
  const references=[...a.references],warnings=[...a.warnings],metrics={...a.metrics}
  const evidenceIds=c.evidenceIds
  const add=(kind:StructuralReference['kind'],price:number,source:StructuralReference['source'])=>{
    const distance=(price-c.entry)*c.sign*(kind==='stop'?-1:1)
    if(distance<=0)return
    references.push({kind,price,source,points:distance/c.pointSize,atrDistance:c.atr&&c.atr>0?distance/c.atr:null,timeframe:c.timeframe,evidenceIds,from:structure.from,through:structure.through})
  }
  const warn=(code:ReviewWarning['code'],dimension:ReviewWarning['dimension'],message:string)=>warnings.push({code,dimension,message,severity:'warning',timeframe:c.timeframe,evidenceIds})
  if(space.stop){
    const price=c.sign===1?space.stop.lower:space.stop.upper
    add('stop',price,'active zone outer edge')
    if(c.h.stopLossPrice!==null&&(c.h.stopLossPrice-price)*c.sign>=0)warn('SL_ACTIVE_ZONE_EXPOSURE','stop','Stop is at or inside the outer edge of a repeated, unbroken structural zone.')
  }
  if(space.target){
    const price=c.sign===1?space.target.lower:space.target.upper
    add('target',price,'active zone near edge')
    metrics.availableSpacePoints=Math.max(0,(price-c.entry)*c.sign/c.pointSize)
  }
  metrics.interveningZoneCount=space.obstacles.length
  if(space.obstacles.length)warn('TP_ACTIVE_ZONE_OBSTACLES','target','Target reaches or crosses '+space.obstacles.length+' active structural zone(s).')
  if((a.strategy==='continuation'||a.strategy==='correction_entry')&&structure.correction){
    const r=structure.correction
    metrics.correctionDepthAtr=r.depthAtr;metrics.correctionRecoveryAtr=r.recoveryAtr
    if(r.recovered)add('stop',r.root.price,'correction root candidate')
    else warn('CORRECTION_RECOVERY_UNCONFIRMED','entry','Confirmed local pivot exists, but recovery has not reached the experimental threshold.')
    if(r.recovered&&c.h.stopLossPrice!==null&&(c.entry-r.root.price)*c.sign>0&&(c.h.stopLossPrice-r.root.price)*c.sign>=0)
      warn('SL_CORRECTION_ROOT_EXPOSURE','stop','Stop is at or before the provisional correction root.')
  }
  return {...a,references,warnings,metrics,structure:{...structure,obstacles:space.obstacles},limitations:[...a.limitations,'Active zones are repeated confirmed pivot clusters without a subsequent close through the buffered outer edge. Correction recovery is provisional, not proof of trend continuation.']}
}
