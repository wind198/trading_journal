import {
  infiniteQueryOptions,
  queryOptions,
  type QueryClient,
} from '@tanstack/react-query'
import { RQ_PERSIST_KEY } from '@/app/(app)/_components/providers/query-provider'
import {
  HISTORY_CANDLE_LIMIT,
  RECENT_CANDLE_LIMIT,
  type LightweightCandle,
} from '@/lib/ticks/candles'
import type { VolumeProfilePayload } from '@/lib/ticks/volume-profile'

const MARKET_QUERY_KEY = ['market'] as const

/** Drop in-memory + localStorage market cache, then refetch active market queries. */
export async function hardReloadMarketQueries(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: MARKET_QUERY_KEY })
  queryClient.removeQueries({ queryKey: MARKET_QUERY_KEY })
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(RQ_PERSIST_KEY)
  }
  await queryClient.refetchQueries({ queryKey: MARKET_QUERY_KEY, type: 'active' })
}

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
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
  })
}

export function volumeProfileKey(fromMsc: number, toMsc: number, intervalSec: number) {
  return ['market', 'volume-profile', MARKET_SYMBOL, fromMsc, toMsc, intervalSec] as const
}

export function volumeProfileQueryOptions(
  fromMsc: number,
  toMsc: number,
  intervalSec: number,
  timeframe: string,
) {
  return queryOptions({
    queryKey: volumeProfileKey(fromMsc, toMsc, intervalSec),
    queryFn: async ({ signal }): Promise<VolumeProfilePayload> => {
      const params = new URLSearchParams({
        symbol: MARKET_SYMBOL,
        from_msc: String(fromMsc),
        to_msc: String(toMsc),
        timeframe,
        interval_sec: String(intervalSec),
      })
      const response = await fetch(`/api/volume-profile?${params}`, { signal })
      if (!response.ok) throw new Error('volume-profile')
      const body = (await response.json()) as { data?: VolumeProfilePayload }
      return body.data ?? { price: [], time: [] }
    },
    staleTime: MARKET_RECENT_STALE_MS,
    gcTime: MARKET_GC_TIME_MS,
    refetchInterval: MARKET_RECENT_REFETCH_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    placeholderData: (previous) => previous,
  })
}
