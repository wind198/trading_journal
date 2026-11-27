import type { WorkspaceAnalysis } from '../market-analysis/workspace'
import type { TradeHypothesis } from './contracts'
import { evaluateHardPolicy, TRADE_RISK_POLICY as policy, type ReviewWarning } from './policy'
import { makeContext } from './context'
import { evaluateStrategy, type StrategyAssessment } from './strategies'

export type AssessmentState = 'BLOCKED' | 'INFEASIBLE' | 'INCOMPLETE' | 'WARNINGS_PRESENT' | 'NO_WARNING_DETECTED'
export function evaluateTrade(data:WorkspaceAnalysis,h:TradeHypothesis){
  const hard=evaluateHardPolicy(h,data.snapshot.pointSize)
  const warnings:ReviewWarning[]=[...hard.warnings]
  const assessments:StrategyAssessment[]=[]
  const matching=h.snapshotId===data.snapshot.id&&h.symbol===data.snapshot.symbol&&data.report.snapshotId===data.snapshot.id
  if(!matching)warnings.push({code:'DATA_INSUFFICIENT',dimension:'data',severity:'unassessed',message:'Hypothesis and market snapshot do not match.',evidenceIds:[]})
  if(matching&&h.entryPrice!==null&&hard.geometry.mode!=='invalid'){
    for(const tf of ['M3','M15'] as const){
      const c=makeContext(data,h,tf),assessment=evaluateStrategy(c)
      assessments.push(assessment);warnings.push(...assessment.warnings)
      if(c.strategy==='countertrend'&&tf==='M15')warnings.push({code:'ENTRY_TIMEFRAME_CONFLICT',dimension:'entry',severity:'warning',message:'Trade direction opposes the experimental M15 trend classification.',timeframe:tf,evidenceIds:c.evidenceIds})
    }
  }
  const state:AssessmentState=warnings.some(w=>w.severity==='block')?'BLOCKED':
    assessments.some(a=>a.feasibleWithinReferences===false)?'INFEASIBLE':
    hard.geometry.mode!=='complete'||!matching||warnings.some(w=>w.severity==='unassessed')?'INCOMPLETE':
    warnings.length?'WARNINGS_PRESENT':'NO_WARNING_DETECTED'
  return {hypothesisId:h.id,revision:h.revision,snapshotId:data.snapshot.id,asOf:data.snapshot.asOf,
    policyVersion:policy.version,experimentalVersion:policy.experimental.version,state,hard,assessments,warnings,
    limitations:['Market thresholds are experimental, not calibrated.','Gross distances exclude spread, commissions and slippage.',
      'Monetary risk and account exposure are unassessed: position size, execution costs and account data unavailable.',
      'References are not proposed orders. Absence of warnings is not trade clearance.']}
}
export type TradeReview=ReturnType<typeof evaluateTrade>
