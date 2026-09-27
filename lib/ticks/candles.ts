export type TickRow = {
  time_msc: number
  bid: number
  ask: number
  last: number
  volume: number
}

/** Candlestick bar. `time` is a Unix timestamp in seconds. */
export type LightweightCandle = {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export const CANDLE_TIMEFRAMES = {
  '5m': 300,
  '15m': 900,
  '1h': 3_600,
  '4h': 14_400,
} as const

export type CandleTimeframe = keyof typeof CANDLE_TIMEFRAMES

export const RECENT_CANDLE_LIMIT = 10
export const HISTORY_CANDLE_LIMIT = 1000

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : Number.NaN
}

/** FX rows store 0 in `last`; use the mid price. A positive `last` wins. */
export function tickPrice(tick: Pick<TickRow, 'bid' | 'ask' | 'last'>): number | null {
  const last = num(tick.last)
  if (last > 0) return last
  const bid = num(tick.bid)
  const ask = num(tick.ask)
  if (bid > 0 && ask > 0) return (bid + ask) / 2
  return null
}

export function ticksToCandles(ticks: readonly TickRow[], intervalSec: number): LightweightCandle[] {
  if (!Number.isInteger(intervalSec) || intervalSec <= 0) {
    throw new Error('intervalSec must be a positive integer')
  }

  const buckets = new Map<number, LightweightCandle>()
  const ordered = [...ticks].sort((a, b) => num(a.time_msc) - num(b.time_msc))

  for (const tick of ordered) {
    const price = tickPrice(tick)
    const timeMsc = num(tick.time_msc)
    if (price == null || !Number.isFinite(timeMsc)) continue
    const time = Math.floor(timeMsc / 1000 / intervalSec) * intervalSec
    const bar = buckets.get(time)
    if (!bar) {
      buckets.set(time, { time, open: price, high: price, low: price, close: price })
      continue
    }
    bar.high = Math.max(bar.high, price)
    bar.low = Math.min(bar.low, price)
    bar.close = price
  }

  return [...buckets.values()]
}
