import type { AnalysisResult, EvidenceReference, MarketSnapshot, NumericalFeature, Timeframe } from './contracts'
import { analyzeFoundation } from './foundation'
import { runNumericalTools } from './tools'
import { classifyRegime, compareRegimes, EXPERIMENTAL_REGIME_POLICY, selectedTools } from './regimes'

/** Experimental observation only. No order, risk clearance or price prediction. */
export function scanMarket(snapshot: MarketSnapshot) {
  const p = EXPERIMENTAL_REGIME_POLICY
  const foundation = analyzeFoundation(snapshot)
  const numerical = runNumericalTools(snapshot, p.windows)
  const classify = (tf: Timeframe) => classifyRegime(snapshot.bars[tf], foundation.timeframes[tf], p,
    foundation.limitations.some(x => x.startsWith(tf + ':') && (x.includes('stale') || x.includes('no completed'))))
  const classifications = { M3: classify('M3'), M15: classify('M15') }
  const regimes = { M3: classifications.M3.regime, M15: classifications.M15.regime }
  const results: AnalysisResult[] = []
  for (const tf of ['M3', 'M15'] as const) {
    const c = classifications[tf], bars = snapshot.bars[tf]
    const selected = selectedTools(c.regime)
    results.push(...numerical.results.filter(r => r.timeframe === tf && selected.includes(r.toolId)))
    const emit = (toolId: string, values: Record<string, [number | null, string, number]>, limitations: string[] = []) => {
      const evidence: EvidenceReference[] = bars.length ? [{
        id: snapshot.id + ':' + tf + ':' + toolId, snapshotId: snapshot.id, timeframe: tf,
        from: bars[0].closeTime, through: bars[bars.length - 1].closeTime,
        calculationId: toolId, calculationVersion: '1', configVersion: foundation.configVersion,
      }] : []
      const features: Record<string, NumericalFeature> = {}
      for (const [key, [value, unit, lookbackBars]] of Object.entries(values)) {
        features[key] = { value, unit, lookbackBars, evidenceIds: evidence.map(e => e.id) }
      }
      results.push({ toolId, version: '1', timeframe: tf, asOf: snapshot.asOf,
        status: Object.values(features).some(f => f.value === null) ? 'insufficient_data' : 'ok',
        features, evidence, limitations: [...foundation.limitations, ...limitations] })
    }
    if (selected.includes('analyze_range_structure')) {
      const r = c.range
      emit('analyze_range_structure', {
        upper: [r?.upper ?? null, 'price', p.windows.range],
        lower: [r?.lower ?? null, 'price', p.windows.range],
        upperTests: [r?.upperTests ?? null, 'count', p.windows.range],
        lowerTests: [r?.lowerTests ?? null, 'count', p.windows.range],
        widthAtr: [r?.widthAtr ?? null, 'ATR', p.windows.range],
        validated: [r ? Number(r.validated) : null, 'boolean', p.windows.range],
      }, ['Experimental pivot-based boundary validation; not proof of future containment.'])
    }
    if (selected.includes('analyze_transition')) emit('analyze_transition', {
      bandwidthGrowth: [c.metrics.bandwidthGrowth, 'ratio', p.windows.transition],
      atrGrowth: [c.metrics.atrGrowth, 'ratio', p.windows.transition],
      outsideValidatedRange: [c.metrics.outside, 'direction', p.windows.range],
    })
  }
  const alignment = compareRegimes(regimes.M3, regimes.M15)
  const alignmentEvidence: EvidenceReference[] = (['M3','M15'] as const).flatMap(tf => {
    const bars = snapshot.bars[tf]
    return bars.length ? [{ id: snapshot.id + ':' + tf + ':analyze_timeframe_alignment',
      snapshotId: snapshot.id, timeframe: tf, from: bars[0].closeTime, through: bars[bars.length - 1].closeTime,
      calculationId: 'analyze_timeframe_alignment', calculationVersion: '1', configVersion: foundation.configVersion }] : []
  })
  results.push({ toolId: 'analyze_timeframe_alignment', version: '1', timeframe: 'multi', asOf: snapshot.asOf,
    status: alignment === 'unknown' ? 'insufficient_data' : 'ok',
    features: { agreement: { value: alignment === 'aligned' ? 1 : alignment === 'opposed' ? -1 : alignment === 'mixed' ? 0 : null,
      unit: 'direction agreement', lookbackBars: 0, evidenceIds: alignmentEvidence.map(e => e.id) } },
    evidence: alignmentEvidence, limitations: ['Timeframe disagreement does not establish reversal; transition has no directional agreement score.'] })
  return { snapshotId: snapshot.id, asOf: snapshot.asOf, configVersion: foundation.configVersion,
    policy: p, status: 'experimental' as const, regimes, classifications, alignment, results,
    limitations: [...foundation.limitations, 'Experimental thresholds; not calibrated or a trading clearance.'] }
}
