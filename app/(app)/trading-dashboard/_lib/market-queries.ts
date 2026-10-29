import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import {
  HISTORY_CANDLE_LIMIT,
  RECENT_CANDLE_LIMIT,
  type LightweightCandle,
} from '@/lib/ticks/candles'
import type { VolumeProfileTickBin } from '@/lib/ticks/volume-profile'

export const MARKET_SYMBOL = 'EURUSD'
export const MARKET_RECENT_REFETCH_MS = 30_000
const MARKET_RECENT_STALE_MS = 25_000
const MARKET_GC_TIME_MS = 30 * 60 * 1000

async function fetchCandles(url: string, signal: AbortSignal): Promise<LightweightCandle[]> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('bars')
  const body = (await response.json()) as { data?: LightweightCandle[] }
  return body.data ?? []
}

export function marketHistoryKey(timeframe: string) {
  return ['market', 'candles', 'history', MARKET_SYMBOL, timeframe] as const
}

export function marketRecentKey(timeframe: string) {
  return ['market', 'candles', 'recent', MARKET_SYMBOL, timeframe] as const
}

export function marketHistoryInfiniteOptions(timeframe: string) {
  return infiniteQueryOptions({
    queryKey: marketHistoryKey(timeframe),
    queryFn: ({ pageParam, signal }) => {
      const before = pageParam == null ? '' : `&before=${pageParam}`
      return fetchCandles(
        `/api/bars/history?timeframe=${timeframe}&limit=${HISTORY_CANDLE_LIMIT}${before}`,
        signal,
      )
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < HISTORY_CANDLE_LIMIT ? undefined : lastPage[0]?.time,
    staleTime: Infinity,
    gcTime: MARKET_GC_TIME_MS,
  })
}

export function marketRecentQueryOptions(timeframe: string) {
  return queryOptions({
    queryKey: marketRecentKey(timeframe),
    queryFn: ({ signal }) =>
      fetchCandles(
        `/api/bars/recent?timeframe=${timeframe}&limit=${RECENT_CANDLE_LIMIT}`,
        signal,
      ),
    staleTime: MARKET_RECENT_STALE_MS,
    gcTime: MARKET_GC_TIME_MS,
    refetchInterval: MARKET_RECENT_REFETCH_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    placeholderData: (previous) => previous,
  })
}

export function volumeProfileKey() {
  return ['market', 'volume-profile', MARKET_SYMBOL] as const
}

export function volumeProfileQueryOptions() {
  return queryOptions({
    queryKey: volumeProfileKey(),
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/volume-profile?symbol=${MARKET_SYMBOL}`, { signal })
      if (!response.ok) throw new Error('volume-profile')
      const body = (await response.json()) as { data?: VolumeProfileTickBin[] }
      return body.data ?? []
    },
    staleTime: MARKET_RECENT_STALE_MS,
    gcTime: MARKET_GC_TIME_MS,
    refetchInterval: MARKET_RECENT_REFETCH_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    placeholderData: (previous) => previous,
  })
}
