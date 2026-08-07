'use client'

import { TradeEntry } from '@/lib/types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'

interface JournalCardProps {
  trade: TradeEntry
  onClick: () => void
  onDelete: (trade: TradeEntry) => void
}

const orderTypeLabel: Record<TradeEntry['order_type'], string> = {
  EXTREME: 'EX',
  TREND_FOLLOWING: 'TF',
}

export function JournalCard({ trade, onClick, onDelete }: JournalCardProps) {
  const isBuy = trade.buy_or_sell === 'BUY'
  const outcomeLabel = trade.win === null ? 'Pend' : trade.win ? 'Win' : 'Loss'
  const outcomeClassName =
    trade.win === null
      ? 'bg-secondary text-secondary-foreground'
      : trade.win
        ? 'bg-success/10 text-success'
        : 'bg-destructive/10 text-destructive'

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group w-full cursor-pointer border-l-4 py-0 transition hover:border-primary',
        isBuy ? 'border-l-success' : 'border-l-destructive'
      )}
    >
      <CardContent className="flex items-center gap-2 px-3 py-2">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md',
            isBuy ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
          )}
          aria-label={isBuy ? 'Buy' : 'Sell'}
          title={isBuy ? 'Buy' : 'Sell'}
        >
          {isBuy ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
        </span>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
            {orderTypeLabel[trade.order_type]}
          </Badge>
          <Badge className={cn('h-5 px-1.5 text-[11px]', outcomeClassName)}>
            {outcomeLabel}
          </Badge>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Delete trade"
          className="shrink-0 text-destructive opacity-100 hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(trade)
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
