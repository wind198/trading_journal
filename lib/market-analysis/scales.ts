import type { MarketSnapshot,Timeframe } from './contracts'
import { calculateFoundation,type FoundationConfig } from './indicators'
import { classifyRegime,EXPERIMENTAL_REGIME_POLICY as p } from './regimes'
import { TIMEFRAME_SECONDS } from './snapshot'
import config from '../../ai/trading_knowledge/config/indicators.json' with {type:'json'}
import policy from '../../ai/trading_knowledge/config/scale-policy.json' with {type:'json'}

export const SCALE_POLICY=policy
export const SCALE_IDS=['baseline','extended','structural'] as const
export type ScaleId=typeof SCALE_IDS[number]
export function scaleConfig(id:ScaleId):FoundationConfig{
 const m=policy.profiles[id].multiplier
 return {atr:{period:config.atr.period*m},adxDmi:{period:config.adxDmi.period*m},
 efficiencyRatio:{period:config.efficiencyRatio.period*m},bollinger:{period:config.bollinger.period*m,stdDev:config.bollinger.stdDev},
 ichimoku:{tenkan:config.ichimoku.tenkan*m,kijun:config.ichimoku.kijun*m,spanB:config.ichimoku.spanB*m,displacement:config.ichimoku.displacement*m},
 regression:{periods:config.regression.periods.map(n=>n*m)}}
}
export function inspectScale(snapshot:MarketSnapshot,tf:Timeframe,id:ScaleId){
 const bars=snapshot.bars[tf],step=TIMEFRAME_SECONDS[tf]*1000,cfg=scaleConfig(id),m=policy.profiles[id].multiplier
 const rangeWindow=p.windows.range*m
 const required=Math.max(rangeWindow+1,cfg.ichimoku.spanB+cfg.ichimoku.displacement,2*cfg.adxDmi.period,cfg.efficiencyRatio.period+1,...cfg.regression.periods)
 const recent=bars.slice(-required)
 const stale=!bars.length||Date.parse(snapshot.asOf)-Date.parse(bars.at(-1)!.closeTime)>=step
 const gap=recent.some((b,i)=>i>0&&Date.parse(b.closeTime)-Date.parse(recent[i-1].closeTime)!==step)
 const quality=stale?'stale':gap?'recent_gap':bars.length<required?'warming_up':'usable'
 const indicators=calculateFoundation(bars,cfg)
 const thresholds=policy.profiles[id]
 const classification=classifyRegime(bars,indicators,{...p,version:p.version+' / scale '+policy.version,
 trend:{...p.trend,minAbsSlopeAtr:thresholds.minAbsSlopeAtr},
 range:{...p.range,maxAbsSlopeAtr:thresholds.maxAbsSlopeAtr},
 windows:{...p.windows,range:rangeWindow,transition:p.windows.transition*m}},quality!=='usable')
 return {id,multiplier:m,config:cfg,required,rangeWindow,quality,classification,indicators}
}
export function inspectLargerScales(snapshot:MarketSnapshot,tf:Timeframe){
 return {extended:inspectScale(snapshot,tf,'extended'),structural:inspectScale(snapshot,tf,'structural')}
}
