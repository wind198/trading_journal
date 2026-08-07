'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { BuyOrSell, OrderType, TradeEntry } from '@/lib/types'

export type DirectionFilter = BuyOrSell | 'ALL'
export type OrderTypeFilter = OrderType | 'ALL'
export type OutcomeFilter = 'ALL' | 'win' | 'loss'

export type TradesFilterState = {
  direction: DirectionFilter
  orderType: OrderTypeFilter
  outcome: OutcomeFilter
}

const DEFAULT_FILTER: TradesFilterState = {
  direction: 'ALL',
  orderType: 'ALL',
  outcome: 'ALL',
}

type TradesFilterContextValue = {
  filter: TradesFilterState
  draft: TradesFilterState
  setDraft: (next: Partial<TradesFilterState>) => void
  applyDraft: () => void
  resetDraft: () => void
  open: boolean
  setOpen: (open: boolean) => void
  isFiltered: boolean
  filterTrades: (trades: TradeEntry[]) => TradeEntry[]
}

const TradesFilterContext = createContext<TradesFilterContextValue | null>(null)

export function TradesFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<TradesFilterState>(DEFAULT_FILTER)
  const [draft, setDraftState] = useState<TradesFilterState>(DEFAULT_FILTER)
  const [open, setOpenState] = useState(false)

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next)
    if (next) setDraftState(filter)
  }, [filter])

  const setDraft = useCallback((next: Partial<TradesFilterState>) => {
    setDraftState((prev) => ({ ...prev, ...next }))
  }, [])

  const applyDraft = useCallback(() => {
    setFilter(draft)
    setOpenState(false)
  }, [draft])

  const resetDraft = useCallback(() => {
    setDraftState(DEFAULT_FILTER)
  }, [])

  const isFiltered =
    filter.direction !== 'ALL' ||
    filter.orderType !== 'ALL' ||
    filter.outcome !== 'ALL'

  const filterTrades = useCallback(
    (trades: TradeEntry[]) =>
      trades.filter((trade) => {
        if (filter.direction !== 'ALL' && trade.buy_or_sell !== filter.direction) {
          return false
        }
        if (filter.orderType !== 'ALL' && trade.order_type !== filter.orderType) {
          return false
        }
        if (filter.outcome === 'win' && trade.win !== true) return false
        if (filter.outcome === 'loss' && trade.win !== false) return false
        return true
      }),
    [filter]
  )

  const value = useMemo(
    () => ({
      filter,
      draft,
      setDraft,
      applyDraft,
      resetDraft,
      open,
      setOpen,
      isFiltered,
      filterTrades,
    }),
    [
      filter,
      draft,
      setDraft,
      applyDraft,
      resetDraft,
      open,
      setOpen,
      isFiltered,
      filterTrades,
    ]
  )

  return (
    <TradesFilterContext.Provider value={value}>
      {children}
    </TradesFilterContext.Provider>
  )
}

export function useTradesFilter() {
  const ctx = useContext(TradesFilterContext)
  if (!ctx) throw new Error('useTradesFilter must be used within TradesFilterProvider')
  return ctx
}
