import type { MarketSnapshot } from './contracts'
import { analyzeFoundation } from './foundation'
import { scanMarket } from './scan'
import { inspectLargerScales } from './scales'
import { forceSeries } from './adapters'

export function buildWorkspaceAnalysis(snapshot: MarketSnapshot) {
  const foundation = analyzeFoundation(snapshot)
  const larger={M3:inspectLargerScales(snapshot,'M3'),M15:inspectLargerScales(snapshot,'M15')}
  return {
    snapshot,
    report: scanMarket(snapshot,larger),
    scaleIndicators:{M3:{extended:larger.M3.extended.indicators,structural:larger.M3.structural.indicators},M15:{extended:larger.M15.extended.indicators,structural:larger.M15.structural.indicators}},
    indicators: {
      M3: { ...foundation.timeframes.M3, force: forceSeries(snapshot.bars.M3, 'M3') },
      M15: { ...foundation.timeframes.M15, force: forceSeries(snapshot.bars.M15, 'M15') },
    },
  }
}
export type WorkspaceAnalysis = ReturnType<typeof buildWorkspaceAnalysis>
