import { getSetup, getSetupByKey } from '@/lib/trade-entry/config'
import type {
  TradeEntryEvent,
  TradeEntryScreen,
  TradeEntryState,
} from '@/lib/trade-entry/types'

export const INITIAL_TRADE_ENTRY_STATE: TradeEntryState = {
  current: { value: 'loading' },
  history: [],
}

function advanceQuestion(
  state: TradeEntryState,
  answer: boolean
): TradeEntryState {
  const current = state.current
  if (current.value !== 'questions') return state

  const setup = getSetupByKey(current.setup)
  const answers = [...current.answers]
  answers[current.index] = answer

  const answeredScreen: TradeEntryScreen = {
    ...current,
    answers,
  }

  if (current.index < setup.questions.length - 1) {
    return {
      current: {
        ...answeredScreen,
        value: 'questions',
        index: current.index + 1,
      },
      history: [...state.history, answeredScreen],
    }
  }

  const verdict = answers.every((item) => item === true) ? 'safe' : 'danger'
  return {
    current: {
      value: 'verdict',
      setup: current.setup,
      verdict,
      answers,
    },
    history: [...state.history, answeredScreen],
  }
}

export function tradeEntryReducer(
  state: TradeEntryState,
  event: TradeEntryEvent
): TradeEntryState {
  switch (event.type) {
    case 'RESET':
      return INITIAL_TRADE_ENTRY_STATE

    case 'GATES_PASSED':
      return { current: { value: 'direction' }, history: [] }

    case 'GATE_BLOCKED':
      return {
        current: {
          value: 'blocked',
          reason: event.reason,
          count: event.count,
        },
        history: [],
      }

    case 'SELECT_DIRECTION':
      if (state.current.value !== 'direction') return state
      return {
        current: {
          value: 'order-type',
          direction: event.direction,
        },
        history: [...state.history, state.current],
      }

    case 'SELECT_ORDER_TYPE': {
      if (state.current.value !== 'order-type') return state
      const setup = getSetup(state.current.direction, event.orderType)

      return {
        current: setup.blocked
          ? {
              value: 'verdict',
              setup: setup.key,
              verdict: 'danger',
              answers: [],
            }
          : {
              value: 'questions',
              setup: setup.key,
              index: 0,
              answers: Array(setup.questions.length).fill(null),
            },
        history: [...state.history, state.current],
      }
    }

    case 'ANSWER':
      return advanceQuestion(state, event.answer)

    case 'NEXT': {
      if (state.current.value !== 'questions') return state
      const answer = state.current.answers[state.current.index]
      return answer === null ? state : advanceQuestion(state, answer)
    }

    case 'BACK': {
      const previous = state.history.at(-1)
      if (!previous) return state
      return {
        current: previous,
        history: state.history.slice(0, -1),
      }
    }
  }
}

export function canGoBack(state: TradeEntryState): boolean {
  return state.history.length > 0
}

export function canGoNext(state: TradeEntryState): boolean {
  return (
    state.current.value === 'questions' &&
    state.current.answers[state.current.index] !== null
  )
}
