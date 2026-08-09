import type { BuyOrSell, OrderType } from '@/lib/types'
import type {
  SetupDefinition,
  SetupKey,
  VerdictKind,
} from '@/lib/trade-entry/types'

const EXTREME_ADVICE = [
  'Do not chase the trade when the price has already rejected too far.',
  'Do not enter when a strong trend candle is approaching.',
  'Do not enter when there is no clearly visible strong resistance on the higher-level time frame.',
  'Use a small risk size because Extreme entries are inherently risky.',
  'Risk-reward ratio (RR) must be between 0.5 and 1.0.',
  'Place the SL with a small buffer beyond the rejection trigger; a higher high is not tolerated.',
  'Place the TP above the nearest resistance level or the Elliott wave origin.',
  'Enter using a market order or a close limit order.',
] as const

const TREND_FOLLOWING_ADVICE = [
  'Do not enter when the correction contains consecutive marubozu candles or a stronger marubozu candle.',
  'Do not enter when the trend has no marubozu at the root level.',
  'Do not enter when the trend is unclear on the higher-level time frame.',
  'Place the SL at the root of the Elliott wave origin, with enough room to avoid premature stops.',
  'Place the TP above the previous high and below strong resistance.',
] as const

const BUY_TF_QUESTIONS = [
  'Is higher level time frame showing a strong trend?',
  'Did the trend break the closest support / resistance (based on key levels & Elliott wave)?',
  'Is price gravitating to a support key level with no stronger marubozu or 3 consecutive marubozu (or does the reaction outweigh corrective sell force)?',
  'Are there no strong resistances ahead?',
] as const

const SELL_EXTREME_QUESTIONS = [
  'Is price slowing down with gravestone dojis or engulfing candles?',
  'Is price slowing down at a strong resistance key level?',
  'Is the support marubozu of the existing uptrend far away?',
] as const

const SELL_TF_QUESTIONS = [
  'Is higher level time frame showing a strong trend?',
  'Did the trend break the closest support / resistance (based on key levels & Elliott wave)?',
  'Is price gravitating to a support key level with no stronger marubozu or 3 consecutive marubozu (or does the reaction outweigh corrective buy force)?',
  'Are there no strong resistances ahead?',
] as const

const ORDER_TYPE_COPY: Record<
  OrderType,
  Pick<SetupDefinition, 'label' | 'description'>
> = {
  EXTREME: {
    label: 'Extreme',
    description:
      'Counter-trend into an extended move. Enter early on the correction — don’t wait for a full reverse.',
  },
  TREND_FOLLOWING: {
    label: 'Trend following',
    description:
      'With-trend entry. Expect continuation — enter at the end of a correction wave.',
  },
}

export const TRADE_ENTRY_SETUPS: Record<
  BuyOrSell,
  Record<OrderType, SetupDefinition>
> = {
  BUY: {
    EXTREME: {
      key: 'BUY_EXTREME',
      direction: 'BUY',
      orderType: 'EXTREME',
      ...ORDER_TYPE_COPY.EXTREME,
      questions: [],
      advice: EXTREME_ADVICE,
      blocked: true,
      verdictTitle: {
        safe: 'Buy order at Extreme is safe',
        danger: 'Buy order at Extreme is dangerous',
      },
    },
    TREND_FOLLOWING: {
      key: 'BUY_TREND_FOLLOWING',
      direction: 'BUY',
      orderType: 'TREND_FOLLOWING',
      ...ORDER_TYPE_COPY.TREND_FOLLOWING,
      questions: BUY_TF_QUESTIONS,
      advice: TREND_FOLLOWING_ADVICE,
      blocked: false,
      verdictTitle: {
        safe: 'Buy order at Trend following is safe',
        danger: 'Trend following Buy order is dangerous',
      },
    },
  },
  SELL: {
    EXTREME: {
      key: 'SELL_EXTREME',
      direction: 'SELL',
      orderType: 'EXTREME',
      ...ORDER_TYPE_COPY.EXTREME,
      questions: SELL_EXTREME_QUESTIONS,
      advice: EXTREME_ADVICE,
      blocked: false,
      verdictTitle: {
        safe: 'Sell order at Extreme is safe',
        danger: 'Extreme Sell order is dangerous',
      },
    },
    TREND_FOLLOWING: {
      key: 'SELL_TREND_FOLLOWING',
      direction: 'SELL',
      orderType: 'TREND_FOLLOWING',
      ...ORDER_TYPE_COPY.TREND_FOLLOWING,
      questions: SELL_TF_QUESTIONS,
      advice: TREND_FOLLOWING_ADVICE,
      blocked: false,
      verdictTitle: {
        safe: 'Sell order at Trend following is safe',
        danger: 'Trend following Sell order is dangerous',
      },
    },
  },
}

const SETUPS_BY_KEY = Object.values(TRADE_ENTRY_SETUPS).reduce(
  (result, directionSetups) => {
    for (const setup of Object.values(directionSetups)) {
      result[setup.key] = setup
    }
    return result
  },
  {} as Record<SetupKey, SetupDefinition>
)

export function getSetup(
  direction: BuyOrSell,
  orderType: OrderType
): SetupDefinition {
  return TRADE_ENTRY_SETUPS[direction][orderType]
}

export function getSetupByKey(key: SetupKey): SetupDefinition {
  return SETUPS_BY_KEY[key]
}

export function getVerdictTitle(
  key: SetupKey,
  verdict: VerdictKind
): string {
  return getSetupByKey(key).verdictTitle[verdict]
}
