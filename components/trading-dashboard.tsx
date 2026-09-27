'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QueryClient, QueryClientProvider, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { PriceChart, type ChartType } from '@/components/price-chart'
import {
  calculateBaseLineBias,
  DEFAULT_BASE_LINE_BIAS_CONFIG,
} from '@/lib/ticks/base-line-bias'
import { ichimoku } from '@/lib/ticks/ichimoku'
import { mergeCandles } from '@/lib/ticks/merge'
import {
  CANDLE_TIMEFRAMES,
  HISTORY_CANDLE_LIMIT,
  RECENT_CANDLE_LIMIT,
  type LightweightCandle,
} from '@/lib/ticks/candles'
import { ArrowDown, ArrowUp, Maximize2, Minimize2, Minus } from 'lucide-react'

const SYMBOL = 'EURUSD'
const SMALL_SCREEN_QUERY = '(min-width: 1280px)'

function useTabletUp() {
  const [tablet, setTablet] = useState(false)
  useEffect(() => {
    const media = window.matchMedia(SMALL_SCREEN_QUERY)
    const update = () => setTablet(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return tablet
}

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'candlestick', label: 'Candle' },
  { id: 'bar', label: 'Bar' },
]

const PANES = [
  { id: '4h', label: '4h' },
  { id: '1h', label: '1h' },
  { id: '15m', label: '15m' },
  { id: '5m', label: '5m' },
] as const

type PaneId = (typeof PANES)[number]['id']
type BiasValue = -1 | 0 | 1

function BiasArrow({ value, compact }: { value: BiasValue | null; compact: boolean }) {
  if (value == null) return null
  const size = compact ? 'size-3' : 'size-3.5'
  if (value === 1) {
    return (
      <ArrowUp
        className={`${size} text-success`}
        aria-label="Bullish base-line bias"
      />
    )
  }
  if (value === -1) {
    return (
      <ArrowDown
        className={`${size} text-destructive`}
        aria-label="Bearish base-line bias"
      />
    )
  }
  return (
    <Minus
      className={`${size} text-muted-foreground`}
      aria-label="Neutral base-line bias"
    />
  )
}

export function TradingDashboard() {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>
  )
}

function Dashboard() {
  const [expanded, setExpanded] = useState<PaneId | null>(null)
  const tablet = useTabletUp()
  const [chartTypes, setChartTypes] = useState<Partial<Record<PaneId, ChartType>>>({})
  const router = useRouter()

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-3 sm:gap-3 sm:px-4">
        <h1 className="min-w-0 truncate text-base font-semibold sm:text-lg">Trading dashboard</h1>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button variant="ghost" asChild>
            <Link href="/journal">Journal</Link>
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      <div
        className={
          expanded
            ? 'flex min-h-0 flex-1 overflow-hidden p-2'
            : 'grid min-h-0 flex-1 grid-cols-1 grid-rows-4 gap-2 overflow-hidden p-2 md:grid-cols-2 md:grid-rows-2'
        }
      >
        {PANES.map((pane) => {
          const isExpanded = expanded === pane.id
          if (expanded && !isExpanded) return null
          const chartType = chartTypes[pane.id] ?? 'line'
          const compact = !isExpanded && !tablet
          return (
            <DashboardPane
              key={pane.id}
              pane={pane}
              isExpanded={isExpanded}
              compact={compact}
              chartType={chartType}
              axesVisible={isExpanded || tablet}
              onChartType={(type) =>
                setChartTypes((current) => ({ ...current, [pane.id]: type }))
              }
              onToggleExpand={() => setExpanded(isExpanded ? null : pane.id)}
            />
          )
        })}
      </div>
    </div>
  )
}

function DashboardPane({
  pane,
  isExpanded,
  compact,
  chartType,
  axesVisible,
  onChartType,
  onToggleExpand,
}: {
  pane: (typeof PANES)[number]
  isExpanded: boolean
  compact: boolean
  chartType: ChartType
  axesVisible: boolean
  onChartType: (type: ChartType) => void
  onToggleExpand: () => void
}) {
  const history = useInfiniteQuery({
    queryKey: ['market', 'candles', 'history', SYMBOL, pane.id],
    queryFn: ({ pageParam, signal }) => {
      const before = pageParam == null ? '' : `&before=${pageParam}`
      return getCandles(
        `/api/bars/history?timeframe=${pane.id}&limit=${HISTORY_CANDLE_LIMIT}${before}`,
        signal,
      )
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < HISTORY_CANDLE_LIMIT ? undefined : lastPage[0]?.time,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  })
  const recent = useQuery({
    queryKey: ['market', 'candles', 'recent', SYMBOL, pane.id],
    queryFn: ({ signal }) =>
      getCandles(`/api/bars/recent?timeframe=${pane.id}&limit=${RECENT_CANDLE_LIMIT}`, signal),
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnMount: true,
    refetchOnWindowFocus: process.env.NODE_ENV !== 'development',
    staleTime: 60 * 1000,
  })
  const loadingOlder = useRef(false)
  const historyBars = useMemo(
    () =>
      (history.data?.pages ?? []).reduce(
        (acc, page) => mergeCandles(acc, page),
        [] as LightweightCandle[],
      ),
    [history.data],
  )
  const candles = useMemo(
    () => mergeCandles(historyBars, recent.data ?? []),
    [historyBars, recent.data],
  )
  const loadOlder = () => {
    if (loadingOlder.current || !history.hasNextPage || history.isFetchingNextPage) return
    loadingOlder.current = true
    void history.fetchNextPage().finally(() => {
      loadingOlder.current = false
    })
  }
  const indicator = useMemo(
    () => ichimoku(candles, CANDLE_TIMEFRAMES[pane.id]),
    [candles, pane.id],
  )
  const bias = useMemo(() => {
    const points = calculateBaseLineBias(candles, DEFAULT_BASE_LINE_BIAS_CONFIG)
    return points.length > 0 ? points[points.length - 1].value : null
  }, [candles])

  return (
    <section
      className={
        isExpanded
          ? 'relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-border'
          : 'relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border'
      }
    >
      <div
        className={
          compact
            ? 'pointer-events-none absolute inset-x-1 top-1 z-10 flex items-center justify-between'
            : 'flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2'
        }
      >
        <h2
          className={
            compact
              ? 'pointer-events-auto flex items-center gap-1 rounded bg-background/60 px-1.5 py-0.5 text-xs font-medium'
              : 'flex items-center gap-1.5 text-sm font-medium'
          }
        >
          EURUSD {pane.label}
          <BiasArrow value={bias} compact={compact} />
        </h2>
        <div
          className={
            compact
              ? 'pointer-events-auto flex items-center'
              : 'flex flex-wrap items-center justify-end gap-1'
          }
        >
          {isExpanded &&
            CHART_TYPES.map((type) => (
              <Button
                key={type.id}
                size="sm"
                variant={chartType === type.id ? 'default' : 'outline'}
                onClick={() => onChartType(type.id)}
              >
                {type.label}
              </Button>
            ))}
          <Button
            variant="ghost"
            size={compact ? 'icon-xs' : 'icon'}
            className={compact ? 'bg-background/60' : undefined}
            aria-label={isExpanded ? 'Collapse window' : 'Expand window'}
            onClick={onToggleExpand}
          >
            {isExpanded ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      </div>
      <div className={compact ? 'absolute inset-0' : 'min-h-0 flex-1'}>
        {history.isPending ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading…
          </p>
        ) : history.isError ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Unable to load market
          </p>
        ) : candles.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No bars
          </p>
        ) : (
          <PriceChart
            candles={candles}
            conversion={indicator.conversion}
            base={indicator.base}
            cloud={indicator.cloud}
            chartType={chartType}
            onLoadOlder={loadOlder}
            axesVisible={axesVisible}
          />
        )}
      </div>
    </section>
  )
}

async function getCandles(url: string, signal: AbortSignal): Promise<LightweightCandle[]> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('bars')
  const body = (await response.json()) as { data?: LightweightCandle[] }
  return body.data ?? []
}
