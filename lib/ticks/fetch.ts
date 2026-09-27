import { createServiceClient } from '../supabase/admin'
import {
  HISTORY_CANDLE_LIMIT,
  RECENT_CANDLE_LIMIT,
  ticksToCandles,
  type CandleTimeframe,
  type LightweightCandle,
  type TickRow,
} from './candles'

export {
  CANDLE_TIMEFRAMES,
  HISTORY_CANDLE_LIMIT,
  RECENT_CANDLE_LIMIT,
  type CandleTimeframe,
} from './candles'

const PAGE = 1000

export type FetchTicksOptions = {
  symbol: string
  /** Newest ticks kept. Defaults to 5000. */
  limit?: number
  fromMsc?: number
  toMsc?: number
}

function row(value: Record<string, unknown>): TickRow {
  return {
    time_msc: Number(value.time_msc),
    bid: Number(value.bid),
    ask: Number(value.ask),
    last: Number(value.last),
    volume: Number(value.volume),
  }
}

/** Latest ticks for a symbol, oldest first. Uses the server secret key. */
export async function fetchTicks(options: FetchTicksOptions): Promise<TickRow[]> {
  const limit = options.limit ?? 5000
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer')

  const supabase = createServiceClient()
  const rows: TickRow[] = []
  let offset = 0

  while (rows.length < limit) {
    const end = offset + Math.min(PAGE, limit - rows.length) - 1
    let query = supabase
      .from('ticks')
      .select('time_msc,bid,ask,last,volume')
      .eq('symbol', options.symbol)
      .order('time_msc', { ascending: false })
      .range(offset, end)

    if (options.fromMsc != null) query = query.gte('time_msc', options.fromMsc)
    if (options.toMsc != null) query = query.lte('time_msc', options.toMsc)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    if (!data?.length) break

    rows.push(...data.map((item) => row(item as Record<string, unknown>)))
    if (data.length < end - offset + 1) break
    offset += data.length
  }

  rows.reverse()
  return rows
}

export async function fetchLightweightCandles(
  options: FetchTicksOptions & { intervalSec: number }
): Promise<LightweightCandle[]> {
  const ticks = await fetchTicks(options)
  return ticksToCandles(ticks, options.intervalSec)
}

function toCandle(item: Record<string, unknown>): LightweightCandle {
  return {
    time: Math.floor(Date.parse(String(item.bucket_start)) / 1000),
    open: Number(item.open),
    high: Number(item.high),
    low: Number(item.low),
    close: Number(item.close),
  }
}

/** One page of bars, oldest first. `before` is an exclusive Unix-second cursor. */
export async function fetchHistoricalCandles(options: {
  symbol: string
  timeframe: CandleTimeframe
  before?: number
  limit?: number
}): Promise<LightweightCandle[]> {
  const limit = options.limit ?? HISTORY_CANDLE_LIMIT
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer')
  if (options.before != null && !Number.isFinite(options.before)) {
    throw new Error('before must be a unix second')
  }

  const supabase = createServiceClient()
  let query = supabase
    .from('candles')
    .select('bucket_start, open, high, low, close')
    .eq('symbol', options.symbol)
    .eq('timeframe', options.timeframe)
    .order('bucket_start', { ascending: false })
    .limit(limit)
  if (options.before != null) {
    query = query.lt('bucket_start', new Date(options.before * 1000).toISOString())
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((item) => toCandle(item as Record<string, unknown>)).reverse()
}

/** Newest bars, oldest first. Default window is 10. */
export async function fetchRecentCandles(options: {
  symbol: string
  timeframe: CandleTimeframe
  limit?: number
}): Promise<LightweightCandle[]> {
  const limit = options.limit ?? RECENT_CANDLE_LIMIT
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('limit must be a positive integer')

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('candles')
    .select('bucket_start, open, high, low, close')
    .eq('symbol', options.symbol)
    .eq('timeframe', options.timeframe)
    .order('bucket_start', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  return (data ?? []).map((item) => toCandle(item as Record<string, unknown>)).reverse()
}
