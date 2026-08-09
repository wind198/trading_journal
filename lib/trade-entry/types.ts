import type { BuyOrSell, OrderType } from '@/lib/types'

export type VerdictKind = 'safe' | 'danger'
export type SetupKey = `${BuyOrSell}_${OrderType}`
export type Answer = boolean | null

export type SetupDefinition = {
  key: SetupKey
  direction: BuyOrSell
  orderType: OrderType
  label: string
  description: string
  questions: readonly string[]
  advice: readonly string[]
  blocked: boolean
  verdictTitle: Record<VerdictKind, string>
}

export type TradeEntryScreen =
  | { value: 'loading' }
  | {
      value: 'blocked'
      reason: 'daily-limit' | 'session'
      count?: number
    }
  | { value: 'direction' }
  | { value: 'order-type'; direction: BuyOrSell }
  | {
      value: 'questions'
      setup: SetupKey
      index: number
      answers: Answer[]
    }
  | {
      value: 'verdict'
      setup: SetupKey
      verdict: VerdictKind
      answers: Answer[]
    }

export type TradeEntryState = {
  current: TradeEntryScreen
  history: TradeEntryScreen[]
}

export type TradeEntryEvent =
  | { type: 'RESET' }
  | { type: 'GATES_PASSED' }
  | {
      type: 'GATE_BLOCKED'
      reason: 'daily-limit' | 'session'
      count?: number
    }
  | { type: 'SELECT_DIRECTION'; direction: BuyOrSell }
  | { type: 'SELECT_ORDER_TYPE'; orderType: OrderType }
  | { type: 'ANSWER'; answer: boolean }
  | { type: 'NEXT' }
  | { type: 'BACK' }

export type GateBlock = Extract<TradeEntryScreen, { value: 'blocked' }>

export type EntryGateContext = {
  now: Date
  getTodayTradeCount: () => Promise<number>
  onError?: (error: unknown) => void
}

export type EntryGate = (
  context: EntryGateContext
) => Promise<GateBlock | null>
