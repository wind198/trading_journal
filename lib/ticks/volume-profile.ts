import { CANDLE_TIMEFRAMES, type CandleTimeframe, type LightweightCandle } from './candles'
import { createServiceClient } from '../supabase/admin'

/** Last N bars on 3m / 15m panes (not wall-clock 24h). */
export const VOLUME_PROFILE_CANDLE_COUNT = 96
export const VOLUME_PROFILE_BIN_SIZE = 0.0001

export type VolumeProfileWindow = {
  fromMsc: number
  toMsc: number
}

/** Tick range covering the last `candleCount` bars (inclusive of bar buckets). */
export function volumeProfileWindowFromCandles(
  candles: readonly LightweightCandle[],
  timeframe: CandleTimeframe,
  candleCount = VOLUME_PROFILE_CANDLE_COUNT,
): VolumeProfileWindow | null {
  if (candles.length === 0) return null
  const intervalSec = CANDLE_TIMEFRAMES[timeframe]
  const slice = candles.slice(-Math.min(candleCount, candles.length))
  const fromMsc = slice[0].time * 1000
  const last = slice[slice.length - 1]
  const toMsc = (last.time + intervalSec) * 1000 - 1
  if (!(toMsc > fromMsc)) return null
  return { fromMsc, toMsc }
}

export type VolumeProfileTickBin = {
  price: number
  tickCount: number
}

export async function fetchVolumeProfileTickCounts(options: {
  symbol: string
  fromMsc: number
  toMsc: number
  binSize?: number
}): Promise<VolumeProfileTickBin[]> {
  const binSize = options.binSize ?? VOLUME_PROFILE_BIN_SIZE
  if (
    !(binSize > 0) ||
    !Number.isFinite(options.fromMsc) ||
    !Number.isFinite(options.toMsc) ||
    !(options.toMsc > options.fromMsc)
  ) {
    throw new Error('volume profile args')
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('volume_profile_tick_counts', {
    p_symbol: options.symbol,
    p_from_msc: options.fromMsc,
    p_to_msc: options.toMsc,
    p_bin_size: binSize,
  })
  if (error) throw new Error(error.message)

  return (data ?? []).map((row: { price: number | string; tick_count: number | string }) => ({
    price: Number(row.price),
    tickCount: Number(row.tick_count),
  }))
}
