import { DisciplineItemKey } from '@/lib/discipline'

export type BuyOrSell = 'BUY' | 'SELL'
export type OrderType = 'EXTREME' | 'TREND_FOLLOWING'

export type TradeEntry = {
  id: string
  user_id: string
  created_at: string
  buy_or_sell: BuyOrSell
  order_type: OrderType
  win: boolean | null
}

export type TradeFormData = {
  buy_or_sell: BuyOrSell
  order_type: OrderType
  win?: boolean | null
}

export type DisciplineDay = {
  id: string
  user_id: string
  check_date: string
  created_at: string
}

export type DisciplineCheckItem = {
  id: string
  day_id: string
  item_key: DisciplineItemKey
  checked: boolean
  updated_at: string
}

/** Flat row used by the matrix UI (day date + item). */
export type DisciplineCheck = {
  id: string
  day_id: string
  check_date: string
  item_key: DisciplineItemKey
  checked: boolean
  updated_at: string
}

export type DateRangePreset = 'today' | 'week' | 'month' | 'custom'

export type DateRange = {
  from: string
  to: string
  preset: DateRangePreset
}

export type Quote = {
  id: string
  user_id: string
  headline: string
  description: string
  created_at: string
}

export type QuoteFormData = {
  headline: string
  description: string
}
