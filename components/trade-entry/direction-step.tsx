import type { BuyOrSell } from '@/lib/types'
import { ChoiceButton } from '@/components/trade-entry/choice-button'
import { TrendingDown, TrendingUp } from 'lucide-react'

type DirectionStepProps = {
  onSelect: (direction: BuyOrSell) => void
}

export function DirectionStep({ onSelect }: DirectionStepProps) {
  return (
    <div className="journal-form__step journal-form__step--direction contents">
      <h1 className="journal-form__title text-center text-2xl font-semibold">
        Direction
      </h1>
      <p className="journal-form__subtitle text-center text-muted-foreground">
        EURUSD
      </p>
      <div className="journal-form__choices grid w-full max-w-sm gap-4">
        <ChoiceButton
          icon={<TrendingUp />}
          label="Buy"
          tone="buy"
          onClick={() => onSelect('BUY')}
        />
        <ChoiceButton
          icon={<TrendingDown />}
          label="Sell"
          tone="sell"
          onClick={() => onSelect('SELL')}
        />
      </div>
    </div>
  )
}
