import type { EvaluationContext } from './context'
import type { StrategyAssessment } from './strategies'
import type { ReviewWarning } from './policy'
import type { ForceDynamics } from '../market-analysis/force-dynamics'
import { FORCE_DYNAMICS_POLICY as p } from '../market-analysis/force-dynamics'

export function enrichForceRisk(c:EvaluationContext,a:StrategyAssessment,d:ForceDynamics,latestClose:number,evidenceIds:readonly string[]):StrategyAssessment{
 if(a.strategy!=='range'||c.stale||!evidenceIds.length)return a
 const warnings=[...a.warnings],metrics={...a.metrics}
 const warn=(code:ReviewWarning['code'],dimension:ReviewWarning['dimension'],message:string,anchorPrice?:number)=>warnings.push({code,dimension,message,severity:'warning',timeframe:c.timeframe,evidenceIds,anchorPrice})
 for(const w of d.windows){
  metrics['forcePressure'+w.n]=w.pressure;metrics['forceIntensity'+w.n]=w.intensity
  metrics['bullForce'+w.n]=w.bull;metrics['bearForce'+w.n]=w.bear
  metrics['bullPersistence'+w.n]=w.bullPersistence;metrics['bearPersistence'+w.n]=w.bearPersistence
  metrics['forceCoverage'+w.n]=w.coverage
 }
 Object.assign(metrics,{forceIntensityPercentile:d.intensityPercentile,forcePressureChange:d.pressureChange,bullForceChange:d.bullChange,bearForceChange:d.bearChange,forceDisplacementAtr:d.displacementAtr,bullForceEfficiency:d.bullEfficiency,bearForceEfficiency:d.bearEfficiency})
 if(d.short.coverage<1||d.broad.coverage<1)
  warn('FORCE_COVERAGE_LIMITED','entry','Force history is incomplete; directional force evidence unavailable.')
 if(d.state==='active_equilibrium')warn('FORCE_ACTIVE_EQUILIBRIUM','stop','Strong balanced candle force relative to prior observations; assess stop exposure against volatility and boundaries.')
 if(d.state==='passive_equilibrium')warn('FORCE_PASSIVE_EQUILIBRIUM','target','Weak balanced candle force relative to prior observations; target may require renewed activity.')
 const adverse=d.short.pressure===null?null:-c.sign*d.short.pressure
 const adversePersistence=c.sign===1?d.short.bearPersistence:d.short.bullPersistence
 if(adverse!==null&&adverse>=p.dominanceMin&&adversePersistence!==null&&adversePersistence>=p.persistenceMin)
  warn('FORCE_ADVERSE_PERSISTENCE','entry','Persistent recent candle force opposes the proposed direction.')
 if((c.sign===1&&d.state==='emerging_bear')||(c.sign===-1&&d.state==='emerging_bull'))
  warn('FORCE_ADVERSE_ACCELERATION','entry','Opposing force is growing while favorable force decays.')
 const atr=c.atr
 if(atr!==null&&atr>0&&Number.isFinite(latestClose)&&a.choppy){
  for(const band of [a.choppy.inner,a.choppy.outer]){
   if(!band)continue
   // Boundary observations describe actual latest price, not the hypothetical entry.
   for(const side of [1,-1] as const){
    const boundary=side===1?band.upper:band.lower
    if(Math.abs(latestClose-boundary)>atr*p.nearBoundaryAtr)continue
    const pressure=d.short.pressure===null?null:d.short.pressure*side
    const persistence=side===1?d.short.bullPersistence:d.short.bearPersistence
    const intensity=side===1?d.short.bull:d.short.bear
    if(pressure===null||pressure<p.dominanceMin||persistence===null||persistence<p.persistenceMin)continue
    const adverseSide=side===-c.sign
    warn('FORCE_BOUNDARY_PRESSURE',adverseSide?'stop':'target',band.id+' boundary faces persistent '+(side===1?'bullish':'bearish')+' force; breakout remains unconfirmed.',boundary)
    if(intensity!==null&&intensity>=p.minSideMeanForce&&d.displacementAtr!==null&&Math.abs(d.displacementAtr)<=p.maxAbsorptionProgressAtr)
      warn('FORCE_ABSORPTION_CANDIDATE','entry','Strong directional candle force near '+band.id+' boundary produces little net displacement; possible absorption, not confirmed reversal.',boundary)
   }
  }
 }
 return {...a,metrics,warnings,forceState:d.state,limitations:[...a.limitations,'Force dynamics '+d.policyVersion+' uses candle-based proxies; no order-flow or breakout probability inference.']}
}
