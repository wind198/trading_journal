import policy from '../../ai/trading_knowledge/config/trade-risk-policy.json' with { type: 'json' }
import type { TradeHypothesis } from './contracts'
import { evaluateGeometry } from './hypothesis'

export const TRADE_RISK_POLICY = policy
export type WarningCode = 'INVALID_GEOMETRY' | 'SL_TOO_CLOSE' | 'TP_TOO_CLOSE' | 'RR_INSUFFICIENT' |
  'TP_BELOW_PREFERRED' | 'REGIME_UNCERTAIN' | 'DATA_INSUFFICIENT' | 'ENTRY_OVEREXTENDED' |
  'ENTRY_TIMEFRAME_CONFLICT' | 'COUNTERTREND_NOT_EXTENDED' | 'COUNTERTREND_ADVERSE_MOMENTUM' |
  'ENTRY_RANGE_LOCATION' | 'SL_INSIDE_NOISE' | 'SL_BEFORE_INVALIDATION' | 'TP_STRUCTURAL_OBSTRUCTION' |
  'TP_OUTSIDE_VALIDATED_RANGE' | 'TP_EXCESSIVE_EXTENSION' | 'STRUCTURAL_SPACE_INFEASIBLE' |
  'TRANSITION_INSTABILITY' | 'PHASE_UNCERTAIN' | 'CONTINUATION_UNCONFIRMED' |
  'STRUCTURAL_TRANSITION_UNCONFIRMED' | 'CORRECTION_ADVERSE_MOMENTUM'
export interface ReviewWarning {
  code: WarningCode
  dimension: 'entry' | 'stop' | 'target' | 'risk' | 'data'
  severity: 'block' | 'warning' | 'unassessed'
  message: string
  evidenceIds: readonly string[]
  timeframe?: 'M3' | 'M15'
}
export function minimumTargetPoints(stopPoints: number) {
  return Math.max(policy.hardConstraints.minTakeProfitPoints, Math.ceil(stopPoints * policy.hardConstraints.minRewardRiskRatio))
}
export function evaluateHardPolicy(h: TradeHypothesis, pointSize: number) {
  const geometry = evaluateGeometry(h, pointSize)
  const warnings: ReviewWarning[] = []
  const add = (code: WarningCode, dimension: ReviewWarning['dimension'], message: string, severity: ReviewWarning['severity']='block') =>
    warnings.push({code, dimension, severity, message, evidenceIds: []})
  for (const error of geometry.errors) add('INVALID_GEOMETRY','risk',error)
  const {riskPoints, rewardPoints, grossRewardRisk} = geometry
  const limits = policy.hardConstraints
  if (riskPoints !== null && riskPoints < limits.minStopLossPoints) add('SL_TOO_CLOSE','stop','SL distance is below '+limits.minStopLossPoints+' points.')
  if (rewardPoints !== null && rewardPoints < limits.minTakeProfitPoints) add('TP_TOO_CLOSE','target','TP distance is below '+limits.minTakeProfitPoints+' points.')
  if (grossRewardRisk !== null && grossRewardRisk < limits.minRewardRiskRatio) add('RR_INSUFFICIENT','risk','Gross reward/risk is below '+limits.minRewardRiskRatio+'.')
  if (rewardPoints !== null && rewardPoints >= limits.minTakeProfitPoints && rewardPoints < policy.softConstraints.preferredTakeProfitPoints)
    add('TP_BELOW_PREFERRED','target','Target is below the preferred '+policy.softConstraints.preferredTakeProfitPoints+' points.','warning')
  return {geometry,warnings,minimumTargetPoints:riskPoints===null?null:minimumTargetPoints(riskPoints)}
}
