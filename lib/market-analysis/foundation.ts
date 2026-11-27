import config from '../../ai/trading_knowledge/config/indicators.json'
import type { MarketSnapshot } from './contracts'
import { calculateFoundation } from './indicators'
import { validateSnapshot } from './snapshot'

/** Versioned config is the sole source of analytical defaults. No regime thresholds yet. */
export function analyzeFoundation(snapshot: MarketSnapshot) {
  const limitations=validateSnapshot(snapshot)
  return {snapshotId:snapshot.id,asOf:snapshot.asOf,configVersion:config.version,
    status:'uncalibrated' as const,limitations,
    timeframes:{M3:calculateFoundation(snapshot.bars.M3,config),M15:calculateFoundation(snapshot.bars.M15,config)}}
}
