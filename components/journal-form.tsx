'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSwipeable } from 'react-swipeable'
import { Button } from '@/components/ui/button'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LineChart,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { BuyOrSell, OrderType, TradeFormData } from '@/lib/types'

type StepId =
  | 'blocked'
  | 'direction'
  | 'buyType'
  | 'sellType'
  | 'questions'
  | 'verdict'

type VerdictKind = 'safe' | 'danger'

interface JournalFormProps {
  open: boolean
  onClose: () => void
  onSave: (data: TradeFormData) => Promise<void>
  isSaving?: boolean
}

const BUY_TF_QUESTIONS = [
  'Is higher level time frame showing a strong trend?',
  'Did the trend break the closest support / resistance (based on key levels & Elliott wave)?',
  'Is price gravitating to a support key level with no stronger marubozu or 3 consecutive marubozu (or does the reaction outweigh corrective sell force)?',
  'Are there no strong resistances ahead?',
]

const SELL_EXTREME_QUESTIONS = [
  'Is price slowing down with gravestone dojis or engulfing candles?',
  'Is price slowing down at a strong resistance key level?',
  'Is the support marubozu of the existing uptrend far away?',
]

const SELL_TF_QUESTIONS = [
  'Is higher level time frame showing a strong trend?',
  'Did the trend break the closest support / resistance (based on key levels & Elliott wave)?',
  'Is price gravitating to a support key level with no stronger marubozu or 3 consecutive marubozu (or does the reaction outweigh corrective buy force)?',
  'Are there no strong resistances ahead?',
]

const ORDER_TYPE_COPY = {
  EXTREME: {
    label: 'Extreme',
    description: 'Counter-trend into an extended move. Enter early on the correction — don’t wait for a full reverse.',
  },
  TREND_FOLLOWING: {
    label: 'Trend following',
    description: 'With-trend entry. Expect continuation — enter at the end of a correction wave.',
  },
} as const

function isBlockedSession(): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const mins = hour * 60 + minute
  return mins >= 14 * 60 && mins < 21 * 60
}

function verdictMessage(
  buyOrSell: BuyOrSell | null,
  orderType: OrderType | null,
  kind: VerdictKind
): string {
  if (buyOrSell === 'BUY' && orderType === 'EXTREME') {
    return 'Buy order at Extreme is dangerous'
  }
  if (buyOrSell === 'BUY' && orderType === 'TREND_FOLLOWING') {
    return kind === 'safe'
      ? 'Buy order at Trend following is safe'
      : 'Trend following Buy order is dangerous'
  }
  if (buyOrSell === 'SELL' && orderType === 'EXTREME') {
    return kind === 'safe'
      ? 'Sell order at Extreme is safe'
      : 'Extreme Sell order is dangerous'
  }
  if (buyOrSell === 'SELL' && orderType === 'TREND_FOLLOWING') {
    return kind === 'safe'
      ? 'Sell order at Trend following is safe'
      : 'Trend following Sell order is dangerous'
  }
  return kind === 'safe' ? 'Order is safe' : 'Order is dangerous'
}

export function JournalForm({
  open,
  onClose,
  onSave,
  isSaving = false,
}: JournalFormProps) {
  const [step, setStep] = useState<StepId>('direction')
  const [buyOrSell, setBuyOrSell] = useState<BuyOrSell | null>(null)
  const [orderType, setOrderType] = useState<OrderType | null>(null)
  const [answers, setAnswers] = useState<(boolean | null)[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [verdict, setVerdict] = useState<VerdictKind | null>(null)
  const [history, setHistory] = useState<StepId[]>([])

  const questions = useMemo(() => {
    if (buyOrSell === 'BUY' && orderType === 'TREND_FOLLOWING') return BUY_TF_QUESTIONS
    if (buyOrSell === 'SELL' && orderType === 'EXTREME') return SELL_EXTREME_QUESTIONS
    if (buyOrSell === 'SELL' && orderType === 'TREND_FOLLOWING') return SELL_TF_QUESTIONS
    return []
  }, [buyOrSell, orderType])

  const reset = () => {
    const blocked = isBlockedSession()
    setStep(blocked ? 'blocked' : 'direction')
    setBuyOrSell(null)
    setOrderType(null)
    setAnswers([])
    setQuestionIndex(0)
    setVerdict(null)
    setHistory([])
  }

  useEffect(() => {
    if (open) reset()
  }, [open])

  const pushStep = (next: StepId) => {
    setHistory((h) => [...h, step])
    setStep(next)
  }

  const goBack = () => {
    if (step === 'questions' && questionIndex > 0) {
      setQuestionIndex((i) => i - 1)
      return
    }
    if (history.length === 0) return
    const prev = history[history.length - 1]
    setHistory((h) => h.slice(0, -1))

    if (prev === 'direction') {
      setBuyOrSell(null)
      setOrderType(null)
      setAnswers([])
      setQuestionIndex(0)
      setVerdict(null)
    } else if (prev === 'buyType' || prev === 'sellType') {
      setOrderType(null)
      setAnswers([])
      setQuestionIndex(0)
      setVerdict(null)
    } else if (prev === 'questions') {
      setVerdict(null)
    }

    setStep(prev)
  }

  const canGoBack =
    step !== 'blocked' &&
    (history.length > 0 || (step === 'questions' && questionIndex > 0))

  const selectDirection = (value: BuyOrSell) => {
    setBuyOrSell(value)
    pushStep(value === 'BUY' ? 'buyType' : 'sellType')
  }

  const startQuestions = (type: OrderType) => {
    setOrderType(type)
    const list =
      buyOrSell === 'BUY'
        ? BUY_TF_QUESTIONS
        : type === 'EXTREME'
          ? SELL_EXTREME_QUESTIONS
          : SELL_TF_QUESTIONS
    setAnswers(Array(list.length).fill(null))
    setQuestionIndex(0)
    pushStep('questions')
  }

  const selectBuyType = (type: OrderType) => {
    setOrderType(type)
    if (type === 'EXTREME') {
      setVerdict('danger')
      pushStep('verdict')
      return
    }
    startQuestions(type)
  }

  const selectSellType = (type: OrderType) => {
    startQuestions(type)
  }

  const answerQuestion = async (yes: boolean) => {
    const nextAnswers = [...answers]
    nextAnswers[questionIndex] = yes
    setAnswers(nextAnswers)

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((i) => i + 1)
      return
    }

    const allYes = nextAnswers.every((a) => a === true)
    const kind: VerdictKind = allYes ? 'safe' : 'danger'
    setVerdict(kind)
    pushStep('verdict')

    if (kind === 'safe' && buyOrSell && orderType) {
      await onSave({ buy_or_sell: buyOrSell, order_type: orderType, win: null })
    }
  }

  const goNext = () => {
    if (step === 'direction' && buyOrSell) {
      pushStep(buyOrSell === 'BUY' ? 'buyType' : 'sellType')
      return
    }
    if (step === 'buyType' && orderType) {
      selectBuyType(orderType)
      return
    }
    if (step === 'sellType' && orderType) {
      selectSellType(orderType)
      return
    }
    if (step === 'questions' && answers[questionIndex] !== null) {
      void answerQuestion(answers[questionIndex] as boolean)
    }
  }

  const canGoNext =
    (step === 'direction' && buyOrSell !== null) ||
    (step === 'buyType' && orderType !== null) ||
    (step === 'sellType' && orderType !== null) ||
    (step === 'questions' && answers[questionIndex] !== null)

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (canGoNext) goNext()
    },
    onSwipedRight: () => {
      if (canGoBack) goBack()
    },
    trackTouch: true,
    trackMouse: true,
    preventScrollOnSwipe: true,
  })

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background text-foreground touch-pan-y"
      {...swipeHandlers}
    >
      <div className="relative flex h-full flex-col px-5 pb-8 pt-safe">
        <button
          type="button"
          aria-label="Close"
          className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm"
          onClick={onClose}
        >
          <X />
        </button>

        {canGoBack && (
          <button
            type="button"
            aria-label="Back"
            className="absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm"
            onClick={goBack}
          >
            <ArrowLeft />
          </button>
        )}

        {canGoNext && (
          <button
            type="button"
            aria-label="Next"
            className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm"
            onClick={goNext}
          >
            <ArrowRight />
          </button>
        )}

        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-10">
          {step === 'blocked' && (
            <TerminalScreen
              title="No trade entry during this time"
              detail="Session blocked 14:00–21:00 (UTC+7)."
              onClose={onClose}
            />
          )}

          {step === 'direction' && (
            <>
              <h1 className="text-center text-2xl font-semibold">Direction</h1>
              <p className="text-center text-muted-foreground">EURUSD</p>
              <div className="grid w-full max-w-sm gap-4">
                <ChoiceButton
                  icon={<TrendingUp />}
                  label="Buy"
                  active={buyOrSell === 'BUY'}
                  tone="buy"
                  onClick={() => selectDirection('BUY')}
                />
                <ChoiceButton
                  icon={<TrendingDown />}
                  label="Sell"
                  active={buyOrSell === 'SELL'}
                  tone="sell"
                  onClick={() => selectDirection('SELL')}
                />
              </div>
            </>
          )}

          {step === 'buyType' && (
            <>
              <h1 className="text-center text-2xl font-semibold">Buy order type</h1>
              <div className="grid w-full max-w-sm gap-4">
                <ChoiceButton
                  icon={<Zap />}
                  label={ORDER_TYPE_COPY.EXTREME.label}
                  description={ORDER_TYPE_COPY.EXTREME.description}
                  active={orderType === 'EXTREME'}
                  onClick={() => selectBuyType('EXTREME')}
                />
                <ChoiceButton
                  icon={<LineChart />}
                  label={ORDER_TYPE_COPY.TREND_FOLLOWING.label}
                  description={ORDER_TYPE_COPY.TREND_FOLLOWING.description}
                  active={orderType === 'TREND_FOLLOWING'}
                  onClick={() => selectBuyType('TREND_FOLLOWING')}
                />
              </div>
            </>
          )}

          {step === 'sellType' && (
            <>
              <h1 className="text-center text-2xl font-semibold">Sell order type</h1>
              <div className="grid w-full max-w-sm gap-4">
                <ChoiceButton
                  icon={<Zap />}
                  label={ORDER_TYPE_COPY.EXTREME.label}
                  description={ORDER_TYPE_COPY.EXTREME.description}
                  active={orderType === 'EXTREME'}
                  onClick={() => selectSellType('EXTREME')}
                />
                <ChoiceButton
                  icon={<LineChart />}
                  label={ORDER_TYPE_COPY.TREND_FOLLOWING.label}
                  description={ORDER_TYPE_COPY.TREND_FOLLOWING.description}
                  active={orderType === 'TREND_FOLLOWING'}
                  onClick={() => selectSellType('TREND_FOLLOWING')}
                />
              </div>
            </>
          )}

          {step === 'questions' && (
            <>
              <p className="text-sm text-muted-foreground">
                Question {questionIndex + 1} / {questions.length}
              </p>
              <h1 className="text-center text-xl font-semibold leading-snug">
                {questions[questionIndex]}
              </h1>
              <div className="grid w-full max-w-sm grid-cols-2 gap-4">
                <ChoiceButton
                  label="Yes"
                  active={answers[questionIndex] === true}
                  tone="buy"
                  onClick={() => void answerQuestion(true)}
                />
                <ChoiceButton
                  label="No"
                  active={answers[questionIndex] === false}
                  tone="sell"
                  onClick={() => void answerQuestion(false)}
                />
              </div>
            </>
          )}

          {step === 'verdict' && verdict && (
            <TerminalScreen
              title={verdictMessage(buyOrSell, orderType, verdict)}
              detail={
                verdict === 'safe'
                  ? isSaving
                    ? 'Saving…'
                    : 'Trade logged. Outcome pending — update win/loss later.'
                  : 'Do not take this trade.'
              }
              tone={verdict === 'safe' ? 'safe' : 'danger'}
              buyOrSell={buyOrSell}
              orderType={orderType}
              checklist={
                questions.length > 0
                  ? questions.map((q, i) => ({
                      question: q,
                      answer: answers[i],
                    }))
                  : []
              }
              onClose={onClose}
              disabled={isSaving}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ChoiceButton({
  label,
  description,
  icon,
  active,
  tone,
  onClick,
}: {
  label: string
  description?: string
  icon?: ReactNode
  active?: boolean
  tone?: 'buy' | 'sell'
  onClick: () => void
}) {
  const idle =
    tone === 'buy'
      ? 'border-success/40 bg-success/5 text-success'
      : tone === 'sell'
        ? 'border-destructive/40 bg-destructive/5 text-destructive'
        : 'border-border bg-card text-foreground'

  const selected =
    tone === 'buy'
      ? 'border-success bg-success/15 text-success'
      : tone === 'sell'
        ? 'border-destructive bg-destructive/15 text-destructive'
        : 'border-primary bg-primary/10 text-primary'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-16 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border px-4 py-4 text-center transition active:scale-[0.98] ${
        active ? selected : idle
      }`}
    >
      <span className="flex items-center gap-2 text-lg font-medium">
        {icon}
        {label}
      </span>
      {description && (
        <span
          className={`text-sm font-normal leading-snug ${
            active || tone ? 'opacity-80' : 'text-muted-foreground'
          }`}
        >
          {description}
        </span>
      )}
    </button>
  )
}

function TerminalScreen({
  title,
  detail,
  tone = 'neutral',
  buyOrSell,
  orderType,
  checklist = [],
  onClose,
  disabled,
}: {
  title: string
  detail?: string
  tone?: 'neutral' | 'safe' | 'danger'
  buyOrSell?: BuyOrSell | null
  orderType?: OrderType | null
  checklist?: { question: string; answer: boolean | null }[]
  onClose: () => void
  disabled?: boolean
}) {
  const color =
    tone === 'safe' ? 'text-success' : tone === 'danger' ? 'text-destructive' : 'text-foreground'

  const orderTypeLabel =
    orderType === 'EXTREME'
      ? 'Extreme'
      : orderType === 'TREND_FOLLOWING'
        ? 'Trend following'
        : null

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5 overflow-y-auto py-4 text-center">
      <h1 className={`text-2xl font-semibold ${color}`}>{title}</h1>
      {detail && <p className="text-sm text-muted-foreground">{detail}</p>}

      <div className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.06em] text-neutral">
          Summary
        </p>
        <ul className="space-y-2 text-sm">
          {buyOrSell && (
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Direction</span>
              <span
                className={
                  buyOrSell === 'BUY'
                    ? 'font-medium text-success'
                    : 'font-medium text-destructive'
                }
              >
                {buyOrSell}
              </span>
            </li>
          )}
          {orderTypeLabel && (
            <li className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Order type</span>
              <span className="font-medium text-foreground">{orderTypeLabel}</span>
            </li>
          )}
        </ul>

        {checklist.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-[0.06em] text-neutral">
              Checklist
            </p>
            <ul className="space-y-3">
              {checklist.map((item, i) => {
                const yes = item.answer === true
                return (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ${
                        yes
                          ? 'bg-success/15 text-success'
                          : 'bg-destructive/15 text-destructive'
                      }`}
                    >
                      {yes ? <Check className="size-3" /> : <X className="size-3" />}
                    </span>
                    <span className="text-sm leading-snug text-foreground">
                      {item.question}
                      <span
                        className={`ml-1.5 font-medium ${
                          yes ? 'text-success' : 'text-destructive'
                        }`}
                      >
                        {yes ? 'Yes' : 'No'}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      <Button size="lg" className="w-full" onClick={onClose} disabled={disabled}>
        Done
      </Button>
    </div>
  )
}
