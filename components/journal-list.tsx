'use client'

import { useMemo, useState } from 'react'
import { TradeEntry } from '@/lib/types'
import { JournalCard } from './journal-card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatVnDateLong, toVnDateKey } from '@/lib/date-range'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface JournalListProps {
  trades: TradeEntry[]
  onSelectTrade: (trade: TradeEntry) => void
  onDeleteTrade: (trade: TradeEntry) => void
  isLoading?: boolean
}

type DayGroup = {
  dateKey: string
  trades: TradeEntry[]
}

export function JournalList({
  trades,
  onSelectTrade,
  onDeleteTrade,
  isLoading,
}: JournalListProps) {
  const groups = useMemo(() => {
    const map = new Map<string, TradeEntry[]>()
    for (const trade of trades) {
      const key = toVnDateKey(trade.created_at)
      const list = map.get(key)
      if (list) list.push(trade)
      else map.set(key, [trade])
    }
    const result: DayGroup[] = [...map.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([dateKey, dayTrades]) => ({ dateKey, trades: dayTrades }))
    return result
  }, [trades])

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/50 px-6 py-12 text-center text-sm text-muted-foreground">
        No trades yet. Create your first trade to get started.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.dateKey] === true
        return (
          <div key={group.dateKey} className="space-y-1.5">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left hover:bg-muted/50"
              onClick={() =>
                setCollapsed((prev) => ({
                  ...prev,
                  [group.dateKey]: !isCollapsed,
                }))
              }
              aria-expanded={!isCollapsed}
            >
              <ChevronDown
                className={cn(
                  'size-4 shrink-0 text-muted-foreground transition-transform',
                  isCollapsed && '-rotate-90'
                )}
              />
              <span className="text-sm font-medium text-foreground">
                {formatVnDateLong(group.dateKey)}
              </span>
              <span className="text-xs text-muted-foreground">
                · {group.trades.length}
              </span>
            </button>

            {!isCollapsed && (
              <div className="space-y-1.5 pl-1">
                {group.trades.map((trade) => (
                  <JournalCard
                    key={trade.id}
                    trade={trade}
                    onClick={() => onSelectTrade(trade)}
                    onDelete={onDeleteTrade}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
