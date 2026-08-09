'use client'

import { Quote } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronDown, Pencil, Trash2 } from 'lucide-react'

interface QuoteCardProps {
  quote: Quote
  expanded: boolean
  onToggle: () => void
  onEdit: (quote: Quote) => void
  onDelete: (quote: Quote) => void
}

export function QuoteCard({
  quote,
  expanded,
  onToggle,
  onEdit,
  onDelete,
}: QuoteCardProps) {
  return (
    <div
      className={cn(
        'quote-card group rounded-lg border border-border bg-card',
        expanded && 'quote-card--expanded'
      )}
    >
      <div className="quote-card__header flex items-start gap-1">
        <button
          type="button"
          className="quote-card__trigger flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          <ChevronDown
            className={cn(
              'quote-card__chevron mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
              !expanded && '-rotate-90'
            )}
          />
          <span className="quote-card__headline text-sm font-medium leading-snug text-foreground">
            {quote.headline}
          </span>
        </button>

        <div className="quote-card__actions mr-1.5 mt-1.5 flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Edit quote"
            className="quote-card__edit text-muted-foreground opacity-100 hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(quote)
            }}
          >
            <Pencil className="quote-card__edit-icon size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete quote"
            className="quote-card__delete text-destructive opacity-100 hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(quote)
            }}
          >
            <Trash2 className="quote-card__delete-icon size-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="quote-card__body border-t border-border px-3 py-2.5 pl-9">
          <p className="quote-card__description whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {quote.description}
          </p>
        </div>
      )}
    </div>
  )
}
