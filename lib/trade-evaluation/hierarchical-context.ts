import type { TradeDirection } from './contracts'
import type { PhaseObservation } from '../market-analysis/phase'
import { resolveStrategy, type StrategyId } from './context'

export type TradeContextKind = 'aligned_continuation' | 'potential_correction_entry' | 'countertrend_correction_trade' |
  'consolidation_continuation' | 'higher_timeframe_countertrend' | 'range_rotation' | 'range_breakout_uncertain' |
  'transition_uncertain' | 'context_unknown' | 'continuation_unconfirmed'
export interface HierarchicalContext {
  kind: TradeContextKind
  primary: StrategyId
  local: StrategyId
  reason: string
  structural: PhaseObservation
  execution: PhaseObservation
}
export function resolveTradeContext(structural:PhaseObservation,execution:PhaseObservation,direction:TradeDirection):HierarchicalContext {
  const primary=resolveStrategy(structural.regime,direction),local=resolveStrategy(execution.regime,direction)
  const result=(kind:TradeContextKind,reason:string):HierarchicalContext=>({kind,primary,local,reason,structural,execution})
  if(structural.regime==='unknown'||execution.regime==='unknown')return result('context_unknown','One or both timeframe regimes are unknown; do not infer structure.')
  if(structural.regime==='transition'||execution.regime==='transition')return result('transition_uncertain','At least one timeframe is transitioning; breakout/retest structure is unconfirmed.')
  if(structural.phase==='unknown'||execution.phase==='unknown')return result('context_unknown','At least one timeframe phase is unresolved.')
  if(primary==='range'){
    return result(local==='range'?'range_rotation':'range_breakout_uncertain',local==='range'?'Both timeframes show ranging conditions.':'Local directional behavior within the broader range may be rotation or breakout; neither is confirmed.')
  }
  if(primary==='continuation'){
    if(local==='countertrend'||structural.phase==='correction_candidate'||execution.phase==='correction_candidate')
      return result('potential_correction_entry','Direction agrees with M15; local correction may be unfinished. Correction root and completion require evidence.')
    if(local==='range'||execution.phase==='consolidation'||structural.phase==='consolidation')
      return result('consolidation_continuation','M15 trend with consolidation; continuation breakout is unconfirmed.')
    if(local==='continuation'&&structural.phase==='expansion'&&execution.phase==='expansion')
      return result('aligned_continuation','Both timeframes show directional expansion aligned with the hypothesis.')
    return result('continuation_unconfirmed','Direction agrees with M15, but expansion/recovery is unconfirmed.')
  }
  if(primary==='countertrend'&&local==='continuation')return result('countertrend_correction_trade','Local trend agrees with the trade, but the hypothesis opposes M15; correction does not establish reversal.')
  return result('higher_timeframe_countertrend','Trade opposes the broader M15 trend; exhaustion and reversal are unconfirmed.')
}
