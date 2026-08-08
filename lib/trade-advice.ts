import { BuyOrSell, OrderType } from '@/lib/types'

/** Advice shown when a trade path is allowed (safe verdict). */
export const TRADE_ADVICE = {
  buy: {
    extreme: [
      // Buy Extreme is blocked in the form; kept for completeness.
      'Do not chase the trade when the price has already rejected too far.',
      'Do not enter when a strong trend candle is approaching.',
      'Do not enter when there is no clearly visible strong resistance on the higher-level time frame.',
      'Use a small risk size because Extreme entries are inherently risky.',
      'Risk-reward ratio (RR) must be between 0.5 and 1.0.',
      'Place the SL with a small buffer beyond the rejection trigger; a higher high is not tolerated.',
      'Place the TP above the nearest resistance level or the Elliott wave origin.',
      'Enter using a market order or a close limit order.'
    ],

    trendFollowing: [
      'Do not enter when the correction contains consecutive marubozu candles or a stronger marubozu candle.',
      'Do not enter when the trend has no marubozu at the root level.',
      'Do not enter when the trend is unclear on the higher-level time frame.',
      'Place the SL at the root of the Elliott wave origin, with enough room to avoid premature stops.',
      'Place the TP above the previous high and below strong resistance.'
    ],
  },
  sell: {
    extreme: [
      // Buy Extreme is blocked in the form; kept for completeness.
      'Do not chase the trade when the price has already rejected too far.',
      'Do not enter when a strong trend candle is approaching.',
      'Do not enter when there is no clearly visible strong resistance on the higher-level time frame.',
      'Use a small risk size because Extreme entries are inherently risky.',
      'Risk-reward ratio (RR) must be between 0.5 and 1.0.',
      'Place the SL with a small buffer beyond the rejection trigger; a higher high is not tolerated.',
      'Place the TP above the nearest resistance level or the Elliott wave origin.',
      'Enter using a market order or a close limit order.'
    ],

    trendFollowing: [
      'Do not enter when the correction contains consecutive marubozu candles or a stronger marubozu candle.',
      'Do not enter when the trend has no marubozu at the root level.',
      'Do not enter when the trend is unclear on the higher-level time frame.',
      'Place the SL at the root of the Elliott wave origin, with enough room to avoid premature stops.',
      'Place the TP above the previous high and below strong resistance.'
    ],
  },
};

export type TradeAdviceDirection = keyof typeof TRADE_ADVICE
export type TradeAdviceOrderType = keyof (typeof TRADE_ADVICE)['buy']

const DIRECTION_KEY: Record<BuyOrSell, TradeAdviceDirection> = {
  BUY: 'buy',
  SELL: 'sell',
}

const ORDER_TYPE_KEY: Record<OrderType, TradeAdviceOrderType> = {
  EXTREME: 'extreme',
  TREND_FOLLOWING: 'trendFollowing',
}

export function getTradeAdvice(
  buyOrSell: BuyOrSell,
  orderType: OrderType
): readonly string[] {
  return TRADE_ADVICE[DIRECTION_KEY[buyOrSell]][ORDER_TYPE_KEY[orderType]]
}
