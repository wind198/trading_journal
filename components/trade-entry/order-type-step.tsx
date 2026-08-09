import type { BuyOrSell, OrderType } from '@/lib/types'
import { TRADE_ENTRY_SETUPS } from '@/lib/trade-entry/config'
import { ChoiceButton } from '@/components/trade-entry/choice-button'
import { LineChart, Zap } from 'lucide-react'

type OrderTypeStepProps = {
  direction: BuyOrSell
  onSelect: (orderType: OrderType) => void
}

const ORDER_TYPES: readonly OrderType[] = ['EXTREME', 'TREND_FOLLOWING']

export function OrderTypeStep({
  direction,
  onSelect,
}: OrderTypeStepProps) {
  return (
    <div
      className={`journal-form__step journal-form__step--${direction.toLowerCase()}-type contents`}
    >
      <h1 className="journal-form__title text-center text-2xl font-semibold">
        {direction === 'BUY' ? 'Buy' : 'Sell'} order type
      </h1>
      <div className="journal-form__choices grid w-full max-w-sm gap-4">
        {ORDER_TYPES.map((orderType) => {
          const setup = TRADE_ENTRY_SETUPS[direction][orderType]
          return (
            <ChoiceButton
              key={orderType}
              icon={
                orderType === 'EXTREME' ? <Zap /> : <LineChart />
              }
              label={setup.label}
              description={setup.description}
              onClick={() => onSelect(orderType)}
            />
          )
        })}
      </div>
    </div>
  )
}
