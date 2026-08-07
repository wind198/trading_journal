'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { TradeEntry, TradeFormData } from '@/lib/types'
import { useDateRange } from '@/components/date-range-provider'
import { useTradesFilter } from '@/components/trades-filter-provider'
import { JournalForm } from '@/components/journal-form'
import { JournalList } from '@/components/journal-list'
import { TradeAnalytics } from '@/components/trade-analytics'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { vnRangeToUtcBounds } from '@/lib/date-range'
import { Plus } from 'lucide-react'

export function TradesScreen() {
  const { range } = useDateRange()
  const { filter, filterTrades, isFiltered } = useTradesFilter()
  const supabase = useMemo(() => createClient(), [])
  const [trades, setTrades] = useState<TradeEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState<TradeEntry | null>(null)
  const [winDraft, setWinDraft] = useState<boolean | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const visibleTrades = useMemo(
    () => filterTrades(trades),
    [filterTrades, trades, filter]
  )

  const analyticsKey = `${filter.direction}-${filter.orderType}-${filter.outcome}`

  const refreshTrades = async (uid: string) => {
    const { startIso, endIso } = vnRangeToUtcBounds(range.from, range.to)
    const { data, error } = await supabase
      .from('trading_journal')
      .select('*')
      .eq('user_id', uid)
      .gte('created_at', startIso)
      .lt('created_at', endIso)
      .order('created_at', { ascending: false })

    if (error) throw error
    setTrades(data || [])
  }

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return
        setUserId(user.id)
        await refreshTrades(user.id)
      } catch (error) {
        console.error('[trades] load error:', error)
        toast.error('Failed to load trades')
      } finally {
        setIsLoading(false)
      }
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to, supabase])

  const handleSaveTrade = async (data: TradeFormData) => {
    if (!userId) return

    setIsSaving(true)
    try {
      const { error } = await supabase.from('trading_journal').insert([
        {
          user_id: userId,
          buy_or_sell: data.buy_or_sell,
          order_type: data.order_type,
          win: null,
        },
      ])
      if (error) throw error
      await refreshTrades(userId)
      toast.success('Trade saved')
    } catch (error) {
      console.error('[trades] save error:', error)
      toast.error('Error saving trade. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdateWin = async () => {
    if (!userId || !selectedTrade) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('trading_journal')
        .update({ win: winDraft })
        .eq('id', selectedTrade.id)
        .eq('user_id', userId)
      if (error) throw error
      await refreshTrades(userId)
      setSelectedTrade(null)
      toast.success('Outcome updated')
    } catch (error) {
      console.error('[trades] update error:', error)
      toast.error('Error updating outcome.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteTrade = async (trade: TradeEntry) => {
    if (!userId) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('trading_journal')
        .delete()
        .eq('id', trade.id)
        .eq('user_id', userId)
      if (error) throw error
      if (selectedTrade?.id === trade.id) setSelectedTrade(null)
      await refreshTrades(userId)
      toast.success('Trade deleted')
    } catch (error) {
      console.error('[trades] delete error:', error)
      toast.error('Error deleting trade.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        size="lg"
        className="h-14 w-full min-w-25 gap-2 text-[15px] font-bold shadow-sm"
        onClick={() => setFormOpen(true)}
      >
        <Plus className="size-5" />
        Add Trade
      </Button>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.06em] text-neutral">
          Trades
        </h2>
        <JournalList
          trades={visibleTrades}
          onSelectTrade={(trade) => {
            setSelectedTrade(trade)
            setWinDraft(trade.win)
          }}
          onDeleteTrade={(trade) => void handleDeleteTrade(trade)}
          isLoading={isLoading}
        />
      </section>

      <section className="space-y-3 border-t border-border pt-6">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-[0.06em] text-neutral">
            Analytics
          </h2>
          {isFiltered && (
            <span className="text-[11px] text-muted-foreground">
              Filtered · {visibleTrades.length}
            </span>
          )}
        </div>
        <TradeAnalytics
          key={analyticsKey}
          trades={visibleTrades}
          isLoading={isLoading}
        />
      </section>

      <JournalForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveTrade}
        isSaving={isSaving}
      />

      <Dialog
        open={!!selectedTrade}
        onOpenChange={(open) => {
          if (!open) setSelectedTrade(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update outcome</DialogTitle>
          </DialogHeader>

          {selectedTrade && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedTrade.buy_or_sell} ·{' '}
                {selectedTrade.order_type === 'EXTREME' ? 'Extreme' : 'Trend following'}
              </p>
              <ToggleGroup
                type="single"
                variant="outline"
                value={winDraft === null ? 'pending' : winDraft ? 'win' : 'loss'}
                onValueChange={(value) => {
                  if (!value) return
                  setWinDraft(value === 'pending' ? null : value === 'win')
                }}
              >
                <ToggleGroupItem value="pending">Pending</ToggleGroupItem>
                <ToggleGroupItem value="win">Win</ToggleGroupItem>
                <ToggleGroupItem value="loss">Loss</ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTrade(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleUpdateWin()} disabled={isSaving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
