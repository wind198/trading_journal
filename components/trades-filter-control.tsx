'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useTradesFilter } from '@/components/trades-filter-provider'
import { Filter } from 'lucide-react'

export function TradesFilterControl() {
  const {
    draft,
    setDraft,
    applyDraft,
    resetDraft,
    open,
    setOpen,
    isFiltered,
  } = useTradesFilter()

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant={isFiltered ? 'default' : 'outline'}
        onClick={() => setOpen(true)}
        aria-label="Filter trades"
        className="relative sm:gap-1.5"
      >
        <Filter className="size-3.5" />
        <span className="hidden sm:inline">Filter</span>
        {isFiltered && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary-foreground sm:static sm:ml-0.5" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-dvh flex-col gap-0 overflow-hidden p-0 sm:max-h-[85vh] sm:max-w-md sm:rounded-xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none max-sm:border-0"
        >
          <DialogHeader className="shrink-0 border-b border-border px-4 py-4 pr-12">
            <DialogTitle>Filter trades</DialogTitle>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
            <FilterSection label="Direction">
              <ToggleGroup
                type="single"
                variant="outline"
                className="flex w-full flex-wrap"
                value={draft.direction}
                onValueChange={(value) => {
                  if (!value) return
                  setDraft({ direction: value as typeof draft.direction })
                }}
              >
                <ToggleGroupItem value="ALL" className="flex-1">
                  Both
                </ToggleGroupItem>
                <ToggleGroupItem value="BUY" className="flex-1">
                  Buy
                </ToggleGroupItem>
                <ToggleGroupItem value="SELL" className="flex-1">
                  Sell
                </ToggleGroupItem>
              </ToggleGroup>
            </FilterSection>

            <FilterSection label="Order type">
              <ToggleGroup
                type="single"
                variant="outline"
                className="flex w-full flex-wrap"
                value={draft.orderType}
                onValueChange={(value) => {
                  if (!value) return
                  setDraft({ orderType: value as typeof draft.orderType })
                }}
              >
                <ToggleGroupItem value="ALL" className="flex-1">
                  Both
                </ToggleGroupItem>
                <ToggleGroupItem value="EXTREME" className="flex-1">
                  EX
                </ToggleGroupItem>
                <ToggleGroupItem value="TREND_FOLLOWING" className="flex-1">
                  TF
                </ToggleGroupItem>
              </ToggleGroup>
            </FilterSection>

            <FilterSection label="Outcome">
              <ToggleGroup
                type="single"
                variant="outline"
                className="flex w-full flex-wrap"
                value={draft.outcome}
                onValueChange={(value) => {
                  if (!value) return
                  setDraft({ outcome: value as typeof draft.outcome })
                }}
              >
                <ToggleGroupItem value="ALL" className="flex-1">
                  Both
                </ToggleGroupItem>
                <ToggleGroupItem value="win" className="flex-1">
                  Win
                </ToggleGroupItem>
                <ToggleGroupItem value="loss" className="flex-1">
                  Loss
                </ToggleGroupItem>
              </ToggleGroup>
            </FilterSection>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t sm:justify-between">
            <Button type="button" variant="ghost" onClick={resetDraft}>
              Reset
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={applyDraft}>
                Apply
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FilterSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-neutral">
        {label}
      </p>
      {children}
    </div>
  )
}
