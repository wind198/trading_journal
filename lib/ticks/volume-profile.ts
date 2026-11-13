import { CANDLE_TIMEFRAMES, type CandleTimeframe, type LightweightCandle } from './candles'
import { createServiceClient } from '../supabase/admin'

/** Last N bars on 3m / 15m panes (not wall-clock 24h). */
export const VOLUME_PROFILE_CANDLE_COUNT = 96
export const VOLUME_PROFILE_BIN_SIZE = 0.0001

export type VolumeProfileTickBin = {
  price: number
  tickCount: number
}

/** Unix-second candle open (matches LWC bar `time`). */
export type VolumeProfileTimeBin = {
  time: number
  tickCount: number
}

export type VolumeProfilePayload = {
  price: VolumeProfileTickBin[]
  time: VolumeProfileTimeBin[]
}

export type VolumeProfileWindow = {
  fromMsc: number
  toMsc: number
  /** Actual bar spacing from candle data (preferred over CANDLE_TIMEFRAMES). */
  intervalSec: number
  /** Unix-second opens for the window slice (one bottom-hist bar each). */
  candleTimes: number[]
}

/** Median positive Δt from the last bars; falls back to timeframe constant. */
export function resolveCandleIntervalSec(
  candles: readonly LightweightCandle[],
  timeframe: CandleTimeframe,
): number {
  const slice = candles.slice(-Math.min(32, candles.length))
  const dts: number[] = []
  for (let i = 1; i < slice.length; i++) {
    const dt = slice[i].time - slice[i - 1].time
    if (dt > 0) dts.push(dt)
  }
  if (dts.length > 0) {
    dts.sort((a, b) => a - b)
    return dts[Math.floor(dts.length / 2)]!
  }
  return CANDLE_TIMEFRAMES[timeframe]
}

/**
 * Collapse arbitrary time bins onto the candle opens in the VP window.
 * Prevents dense/mis-bucketed RPC rows from drawing thousands of bottom bars.
 */
export function alignTimeBinsToCandleOpens(
  timeBins: readonly VolumeProfileTimeBin[],
  candleTimes: readonly number[],
  intervalSec: number,
): VolumeProfileTimeBin[] {
  if (candleTimes.length === 0 || !(intervalSec > 0)) return []
  const counts = new Map<number, number>()
  for (const t of candleTimes) counts.set(t, 0)

  const opens = candleTimes
  for (const bin of timeBins) {
    if (!(bin.tickCount > 0) || !Number.isFinite(bin.time)) continue
    // Greatest candle open ≤ bin.time
    let lo = 0
    let hi = opens.length - 1
    let target = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (opens[mid]! <= bin.time) {
        target = opens[mid]!
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    if (target < 0) continue
    if (bin.time >= target + intervalSec) continue
    counts.set(target, (counts.get(target) ?? 0) + bin.tickCount)
  }

  return opens
    .map((time) => ({ time, tickCount: counts.get(time) ?? 0 }))
    .filter((b) => b.tickCount > 0)
}

/** Tick range covering the last `candleCount` bars (inclusive of bar buckets). */
export function volumeProfileWindowFromCandles(
  candles: readonly LightweightCandle[],
  timeframe: CandleTimeframe,
  candleCount = VOLUME_PROFILE_CANDLE_COUNT,
): VolumeProfileWindow | null {
  if (candles.length === 0) return null
  const intervalSec = resolveCandleIntervalSec(candles, timeframe)
  const slice = candles.slice(-Math.min(candleCount, candles.length))
  const candleTimes = slice.map((c) => c.time)
  const fromMsc = slice[0].time * 1000
  const last = slice[slice.length - 1]
  const toMsc = (last.time + intervalSec) * 1000 - 1
  if (!(toMsc > fromMsc)) return null
  return { fromMsc, toMsc, intervalSec, candleTimes }
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

export async function fetchVolumeProfileTimeTickCounts(options: {
  symbol: string
  fromMsc: number
  toMsc: number
  intervalSec: number
}): Promise<VolumeProfileTimeBin[]> {
  if (
    !(options.intervalSec > 0) ||
    !Number.isFinite(options.fromMsc) ||
    !Number.isFinite(options.toMsc) ||
    !(options.toMsc > options.fromMsc)
  ) {
    throw new Error('volume profile time args')
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc('volume_profile_time_tick_counts', {
    p_symbol: options.symbol,
    p_from_msc: options.fromMsc,
    p_to_msc: options.toMsc,
    p_interval_sec: options.intervalSec,
  })
  if (error) throw new Error(error.message)

  return (data ?? []).map(
    (row: { bucket_time: number | string; tick_count: number | string }) => ({
      time: Number(row.bucket_time),
      tickCount: Number(row.tick_count),
    }),
  )
}

/** Price + time histograms for the same tick window. */
export async function fetchVolumeProfilePayload(options: {
  symbol: string
  fromMsc: number
  toMsc: number
  intervalSec: number
  binSize?: number
}): Promise<VolumeProfilePayload> {
  const [price, time] = await Promise.all([
    fetchVolumeProfileTickCounts(options),
    fetchVolumeProfileTimeTickCounts(options),
  ])
  return { price, time }
}
