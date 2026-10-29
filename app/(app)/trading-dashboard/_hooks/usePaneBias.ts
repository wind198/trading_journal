'use client'

import { useMemo } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { mergeCandles } from '@/lib/ticks/merge'
import type { LightweightCandle } from '@/lib/ticks/candles'
import {
  marketHistoryInfiniteOptions,
  marketRecentQueryOptions,
} from '../_lib/market-queries'
import {
  calculateBaseLineBias,
  DEFAULT_BASE_LINE_BIAS_CONFIG,
} from '../_lib/bias/base-line-bias'
import type { BiasValue } from '../_lib/guides/regime'

export function usePaneBias(timeframe: string): BiasValue | null {
  const history = useInfiniteQuery(marketHistoryInfiniteOptions(timeframe))
  const recent = useQuery(marketRecentQueryOptions(timeframe))
  const candles = useMemo(() => {
    const historyBars = (history.data?.pages ?? []).reduce(
      (acc, page) => mergeCandles(acc, page),
      [] as LightweightCandle[],
    )
    return mergeCandles(historyBars, recent.data ?? [])
  }, [history.data, recent.data])

  return useMemo(() => {
    const points = calculateBaseLineBias(candles, DEFAULT_BASE_LINE_BIAS_CONFIG)
    return points.length > 0 ? points[points.length - 1].value : null
  }, [candles])
}
