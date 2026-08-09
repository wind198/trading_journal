'use client'

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { BuyOrSell, OrderType, TradeFormData } from '@/lib/types'
import { getSetupByKey } from '@/lib/trade-entry/config'
import { runEntryGates } from '@/lib/trade-entry/gates'
import {
  canGoBack,
  canGoNext,
  INITIAL_TRADE_ENTRY_STATE,
  tradeEntryReducer,
} from '@/lib/trade-entry/machine'
import { createTradeEntryRepository } from '@/lib/trade-entry/repository'
import { createClient } from '@/lib/supabase/client'

type UseTradeEntryFlowProps = {
  open: boolean
  onSave: (data: TradeFormData) => Promise<void>
}

export function useTradeEntryFlow({
  open,
  onSave,
}: UseTradeEntryFlowProps) {
  const supabase = useMemo(() => createClient(), [])
  const repository = useMemo(
    () => createTradeEntryRepository(supabase),
    [supabase]
  )
  const [state, dispatch] = useReducer(
    tradeEntryReducer,
    INITIAL_TRADE_ENTRY_STATE
  )
  const saveTriggeredRef = useRef(false)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    saveTriggeredRef.current = false
    dispatch({ type: 'RESET' })

    const boot = async () => {
      const block = await runEntryGates({
        now: new Date(),
        getTodayTradeCount: repository.getTodayTradeCount,
        onError: (error) =>
          console.error('[journal-form] daily limit check failed:', error),
      })

      if (cancelled) return
      if (block) {
        dispatch({
          type: 'GATE_BLOCKED',
          reason: block.reason,
          count: block.count,
        })
      } else {
        dispatch({ type: 'GATES_PASSED' })
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [open, repository])

  const selectDirection = useCallback((direction: BuyOrSell) => {
    dispatch({ type: 'SELECT_DIRECTION', direction })
  }, [])

  const selectOrderType = useCallback((orderType: OrderType) => {
    dispatch({ type: 'SELECT_ORDER_TYPE', orderType })
  }, [])

  const answerQuestion = useCallback(
    async (answer: boolean) => {
      const current = state.current
      if (current.value !== 'questions') return

      const setup = getSetupByKey(current.setup)
      const nextAnswers = [...current.answers]
      nextAnswers[current.index] = answer
      const isFinal = current.index === setup.questions.length - 1
      const isSafe = isFinal && nextAnswers.every((item) => item === true)

      dispatch({ type: 'ANSWER', answer })

      if (isSafe && !saveTriggeredRef.current) {
        saveTriggeredRef.current = true
        await onSave({
          buy_or_sell: setup.direction,
          order_type: setup.orderType,
          win: null,
        })
      }
    },
    [onSave, state.current]
  )

  const goBack = useCallback(() => {
    dispatch({ type: 'BACK' })
  }, [])

  const goNext = useCallback(() => {
    const current = state.current
    if (current.value !== 'questions') return
    const answer = current.answers[current.index]
    if (answer !== null) void answerQuestion(answer)
  }, [answerQuestion, state.current])

  const current = state.current
  const setup =
    current.value === 'questions' || current.value === 'verdict'
      ? getSetupByKey(current.setup)
      : null

  return {
    current,
    setup,
    canGoBack: canGoBack(state),
    canGoNext: canGoNext(state),
    selectDirection,
    selectOrderType,
    answerQuestion,
    goBack,
    goNext,
  }
}
