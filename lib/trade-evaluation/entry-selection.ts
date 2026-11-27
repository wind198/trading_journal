import type { Timeframe } from '../market-analysis/contracts'
import type { TradeDirection, TradeHypothesis } from './contracts'
import { normalizePrice } from './hypothesis'

export interface EntryDraft { snapshotId:string; hypothesisId:string; revision:number; price:number; timeframe:Timeframe }
export function confirmEntry(h:TradeHypothesis,draft:EntryDraft,pointSize:number):TradeHypothesis {
  if(h.snapshotId!==draft.snapshotId||h.id!==draft.hypothesisId||h.revision!==draft.revision)return h
  const price=normalizePrice(draft.price,pointSize)
  if(price===null)return h
  return {...h,entryPrice:price,entryTimeframe:draft.timeframe,stopLossPrice:null,takeProfitPrice:null,revision:h.revision+1}
}
export function changeEntryDirection(h:TradeHypothesis,direction:TradeDirection):TradeHypothesis{
  return h.direction===direction?h:{...h,direction,stopLossPrice:null,takeProfitPrice:null,revision:h.revision+1}
}
export function refreshEntrySnapshot(h:TradeHypothesis,snapshotId:string):TradeHypothesis{
  return h.snapshotId===snapshotId?h:{...h,snapshotId,stopLossPrice:null,takeProfitPrice:null,revision:h.revision+1}
}
