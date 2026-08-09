'use client'

import { useSwipeable } from 'react-swipeable'
import { ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react'
import type { TradeFormData } from '@/lib/types'
import { useTradeEntryFlow } from '@/hooks/use-trade-entry-flow'
import { DirectionStep } from '@/components/trade-entry/direction-step'
import { OrderTypeStep } from '@/components/trade-entry/order-type-step'
import { QuestionsStep } from '@/components/trade-entry/questions-step'
import { TerminalStep } from '@/components/trade-entry/terminal-step'
import { cn } from '@/lib/utils'

interface JournalFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: TradeFormData) => Promise<void>
  isSaving?: boolean
}

export function JournalForm({
  open,
  onClose,
  onSave,
  isSaving = false,
}: JournalFormProps) {
  const flow = useTradeEntryFlow({ open, onSave })
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (flow.canGoNext) flow.goNext()
    },
    onSwipedRight: () => {
      if (flow.canGoBack) flow.goBack()
    },
    trackTouch: true,
    trackMouse: true,
    preventScrollOnSwipe: true,
  })

  if (!open) return null

  const { current, setup } = flow

  return (
    <div
      className={cn(
        'journal-form fixed inset-0 z-50 flex flex-col bg-background text-foreground touch-pan-y',
        `journal-form--${current.value}`
      )}
      {...swipeHandlers}
    >
      <div className="journal-form__inner relative flex h-full flex-col px-0 pb-8 pt-safe md:px-5">
        <button
          type="button"
          aria-label="Close"
          className="journal-form__close absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm"
          onClick={onClose}
        >
          <X />
        </button>

        {flow.canGoBack && (
          <button
            type="button"
            aria-label="Back"
            className="journal-form__back absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm"
            onClick={flow.goBack}
          >
            <ArrowLeft />
          </button>
        )}

        {flow.canGoNext && (
          <button
            type="button"
            aria-label="Next"
            className="journal-form__next absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm"
            onClick={flow.goNext}
          >
            <ArrowRight />
          </button>
        )}

        <div className="journal-form__body flex flex-1 flex-col items-center justify-center gap-6 px-4 md:px-6">
          {current.value === 'loading' && (
            <div className="journal-form__loading flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              <p className="text-sm">Checking daily limit…</p>
            </div>
          )}

          {current.value === 'blocked' && (
            <TerminalStep
              title={
                current.reason === 'daily-limit'
                  ? 'Maximum 3 trades per day reached'
                  : 'No trade entry during this time'
              }
              detail={
                current.reason === 'daily-limit'
                  ? `You already logged ${current.count ?? 3} trades today (UTC+7).`
                  : 'Session blocked 14:00–21:00 (UTC+7).'
              }
              tone={current.reason === 'daily-limit' ? 'danger' : 'neutral'}
              onClose={onClose}
            />
          )}

          {current.value === 'direction' && (
            <DirectionStep onSelect={flow.selectDirection} />
          )}

          {current.value === 'order-type' && (
            <OrderTypeStep
              direction={current.direction}
              onSelect={flow.selectOrderType}
            />
          )}

          {current.value === 'questions' && setup && (
            <QuestionsStep
              setup={setup}
              index={current.index}
              answers={current.answers}
              onAnswer={(answer) => void flow.answerQuestion(answer)}
            />
          )}

          {current.value === 'verdict' && setup && (
            <TerminalStep
              title={setup.verdictTitle[current.verdict]}
              detail={
                current.verdict === 'safe'
                  ? isSaving
                    ? 'Saving…'
                    : 'Trade logged. Outcome pending — update win/loss later.'
                  : 'Do not take this trade.'
              }
              tone={current.verdict}
              setup={setup}
              answers={current.answers}
              showAdvice={current.verdict === 'safe'}
              onClose={onClose}
              disabled={isSaving}
            />
          )}
        </div>
      </div>
    </div>
  )
}
