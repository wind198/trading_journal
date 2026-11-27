import type { MarketSnapshot } from './contracts'
import { analyzeFoundation } from './foundation'
import { scanMarket } from './scan'
import { forceSeries } from './adapters'

export function buildWorkspaceAnalysis(snapshot: MarketSnapshot) {
  const foundation = analyzeFoundation(snapshot)
  return {
    snapshot,
    report: scanMarket(snapshot),
    indicators: {
      M3: { ...foundation.timeframes.M3, force: forceSeries(snapshot.bars.M3, 'M3') },
      M15: { ...foundation.timeframes.M15, force: forceSeries(snapshot.bars.M15, 'M15') },
    },
  }
}
export type WorkspaceAnalysis = ReturnType<typeof buildWorkspaceAnalysis>
