'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PriceChart, type ChartType, type DrawTool } from '../chart/price-chart'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  deleteChartDrawing,
  insertDrawing,
  insertPolylineArrow,
  isPolylineArrowKind,
  loadChartDrawings,
  updatePolylineArrow,
  type ChartDrawing,
  type ChartDrawingKind,
  type DrawingPoint,
} from '../../_lib/chart/chart-drawings'
import {
  CHART_ICON_DEFINITIONS,
  isChartIconKind,
  type ChartIconKind,
} from '../../_lib/chart/chart-icons'
import { useDebouncedDrawingPersist } from '../../_hooks/useDebouncedDrawingPersist'
import {
  calculateForceDecay,
  DEFAULT_FORCE_DECAY_CONFIG,
  filterConsecutiveForceDisplay,
  type ForceEvent,
} from '../../_lib/overlays/force-candle-decay'
import {
  DEFAULT_ENGULFING_CONFIG,
  scanEngulfing,
  type EngulfingEvent,
} from '../../_lib/overlays/engulfing'
import {
  calculateBaseLineBias,
  DEFAULT_BASE_LINE_BIAS_CONFIG,
} from '../../_lib/bias/base-line-bias'
import { mergeCandles } from '@/lib/ticks/merge'
import type { LightweightCandle } from '@/lib/ticks/candles'
import {
  marketHistoryInfiniteOptions,
  marketRecentQueryOptions,
} from '../../_lib/market-queries'
import {
  ArrowDown,
  ArrowUp,
  Expand,
  Maximize2,
  Minimize2,
  Minus,
  Shrink,
  MapPin,
  Spline,
  Square,
  Trash2,
  TrendingUp,
} from 'lucide-react'

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
  { id: '3m', label: '3m' },
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
  return <Dashboard />
}

function Dashboard() {
  const [expanded, setExpanded] = useState<PaneId | null>(null)
  const [fullScreen, setFullScreen] = useState(false)
  const tablet = useTabletUp()
  const [chartTypes, setChartTypes] = useState<Partial<Record<PaneId, ChartType>>>({})
  const router = useRouter()

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <div className="relative flex h-dvh max-h-dvh flex-col overflow-hidden bg-background">
      {!fullScreen && (
        <header className="flex shrink-0 items-center justify-between gap-1.5 border-b border-border px-2 py-1.5 sm:gap-2 sm:px-3">
          <h1 className="min-w-0 truncate text-sm font-semibold">Trading dashboard</h1>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Enter fullscreen"
              onClick={() => setFullScreen(true)}
            >
              <Expand />
            </Button>
          </div>
        </header>
      )}
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
          const chartType = isExpanded ? (chartTypes[pane.id] ?? 'candlestick') : 'line'
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
              onToggleExpand={() => {
                if (isExpanded) {
                  setExpanded(null)
                  return
                }
                setExpanded(pane.id)
                setChartTypes((current) => ({ ...current, [pane.id]: 'candlestick' }))
              }}
            />
          )
        })}
      </div>
      {fullScreen && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 bg-background/80 shadow-md backdrop-blur-sm"
          aria-label="Exit fullscreen"
          onClick={() => setFullScreen(false)}
        >
          <Shrink />
          Exit
        </Button>
      )}
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
  const history = useInfiniteQuery(marketHistoryInfiniteOptions(pane.id))
  const recent = useQuery(marketRecentQueryOptions(pane.id))
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
  const bias = useMemo(() => {
    const points = calculateBaseLineBias(candles, DEFAULT_BASE_LINE_BIAS_CONFIG)
    return points.length > 0 ? points[points.length - 1].value : null
  }, [candles])

  // Lazy + cached: skip work when collapsed; memoized by candles identity when expanded.
  // Calc keeps all events; display drops consecutive force candles after the first.
  const forceEvents = useMemo((): ForceEvent[] => {
    if (!isExpanded || candles.length === 0) return []
    const { activeEvents } = calculateForceDecay(candles, DEFAULT_FORCE_DECAY_CONFIG)
    return filterConsecutiveForceDisplay(activeEvents)
  }, [isExpanded, candles])

  const engulfingEvents = useMemo((): EngulfingEvent[] => {
    if (!isExpanded || candles.length === 0) return []
    return scanEngulfing(candles, DEFAULT_ENGULFING_CONFIG)
  }, [isExpanded, candles])

  const [drawTool, setDrawTool] = useState<DrawTool>(null)
  const [drawings, setDrawings] = useState<ChartDrawing[]>([])
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)
  const [labelEditDrawingId, setLabelEditDrawingId] = useState<string | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const { queuePersist, commitPersist, queuePolylinePersist, commitPolylinePersist } =
    useDebouncedDrawingPersist(pane.id, setDrawings)

  useEffect(() => {
    if (isExpanded) return
    setDrawTool(null)
    setSelectedDrawingId(null)
  }, [isExpanded])

  useEffect(() => {
    let cancelled = false
    void loadChartDrawings(SYMBOL, pane.id)
      .then((rows) => {
        if (!cancelled) setDrawings(rows)
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load drawings')
      })
    return () => {
      cancelled = true
    }
  }, [pane.id])

  const onDrawingChange = (id: string, p1: DrawingPoint, p2: DrawingPoint) => {
    setDrawings((current) =>
      current.map((d) => (d.id === id ? { ...d, p1, p2 } : d)),
    )
    queuePersist(id, p1, p2)
  }

  const onDrawingChangeEnd = (id: string) => {
    commitPersist(id)
  }

  const trendlineDrawings = useMemo(
    () =>
      drawings
        .filter((d) => d.kind === 'trendline')
        .map((d) => ({ id: d.id, p1: d.p1, p2: d.p2 })),
    [drawings],
  )
  const rectangleDrawings = useMemo(
    () =>
      drawings
        .filter((d) => d.kind === 'rectangle')
        .map((d) => ({ id: d.id, p1: d.p1, p2: d.p2 })),
    [drawings],
  )
  const iconDrawings = useMemo(
    () =>
      drawings
        .filter((d) => isChartIconKind(d.kind))
        .map((d) => ({ id: d.id, kind: d.kind as ChartIconKind, p1: d.p1 })),
    [drawings],
  )
  const polylineDrawings = useMemo(
    () =>
      drawings
        .filter((d) => isPolylineArrowKind(d.kind) && d.points && d.points.length >= 2)
        .map((d) => ({
          id: d.id,
          points: d.points!,
          label: d.label,
        })),
    [drawings],
  )

  const iconToolActive = drawTool != null && isChartIconKind(drawTool)

  const toggleTool = (tool: ChartDrawingKind) => {
    setDrawTool((current) => (current === tool ? null : tool))
  }

  const selectIconTool = (kind: ChartIconKind) => {
    setDrawTool((current) => (current === kind ? null : kind))
  }

  const onDrawingComplete = (input: {
    kind: ChartDrawingKind
    p1: DrawingPoint
    p2: DrawingPoint
  }) => {
    if (!isChartIconKind(input.kind) && !isPolylineArrowKind(input.kind)) {
      setDrawTool(null)
    }
    const anchor = input.p1
    const tempId = `temp-${Date.now()}`
    const optimistic: ChartDrawing = {
      id: tempId,
      symbol: SYMBOL,
      timeframe: pane.id,
      kind: input.kind,
      p1: anchor,
      p2: isChartIconKind(input.kind) ? anchor : input.p2,
    }
    setDrawings((current) => [...current, optimistic])
    void insertDrawing({
      symbol: SYMBOL,
      timeframe: pane.id,
      kind: input.kind,
      p1: anchor,
      p2: isChartIconKind(input.kind) ? anchor : input.p2,
    })
      .then((saved) => {
        setDrawings((current) => current.map((d) => (d.id === tempId ? saved : d)))
      })
      .catch(() => {
        setDrawings((current) => current.filter((d) => d.id !== tempId))
        toast.error(`Failed to save ${input.kind}`)
      })
  }

  const onDrawingDelete = (id: string) => {
    setSelectedDrawingId((current) => (current === id ? null : current))
    if (id.startsWith('temp-')) {
      setDrawings((current) => current.filter((d) => d.id !== id))
      return
    }
    let previous: ChartDrawing[] = []
    setDrawings((current) => {
      previous = current
      return current.filter((d) => d.id !== id)
    })
    void deleteChartDrawing(id).catch(() => {
      setDrawings(previous)
      toast.error('Failed to delete drawing')
    })
  }

  const deleteSelectedDrawing = () => {
    if (!selectedDrawingId) return
    onDrawingDelete(selectedDrawingId)
  }

  const onPolylineComplete = (input: { points: DrawingPoint[] }) => {
    if (input.points.length < 2) return
    setDrawTool(null)
    const first = input.points[0]
    const last = input.points[input.points.length - 1]
    const tempId = `temp-${Date.now()}`
    const optimistic: ChartDrawing = {
      id: tempId,
      symbol: SYMBOL,
      timeframe: pane.id,
      kind: 'polyline_arrow',
      p1: first,
      p2: last,
      points: input.points,
      label: '',
    }
    setDrawings((current) => [...current, optimistic])
    void insertPolylineArrow({
      symbol: SYMBOL,
      timeframe: pane.id,
      points: input.points,
      label: '',
    })
      .then((saved) => {
        setDrawings((current) => current.map((d) => (d.id === tempId ? saved : d)))
      })
      .catch(() => {
        setDrawings((current) => current.filter((d) => d.id !== tempId))
        toast.error('Failed to save polyline arrow')
      })
  }

  const onPolylineChange = (id: string, points: DrawingPoint[]) => {
    if (points.length < 2) return
    const first = points[0]
    const last = points[points.length - 1]
    setDrawings((current) =>
      current.map((d) =>
        d.id === id ? { ...d, points, p1: first, p2: last } : d,
      ),
    )
    queuePolylinePersist(id, points)
  }

  const onPolylineChangeEnd = (id: string) => {
    commitPolylinePersist(id)
  }

  const openLabelEditor = (id: string) => {
    const drawing = drawings.find((d) => d.id === id)
    setLabelEditDrawingId(id)
    setLabelDraft(drawing?.label ?? '')
  }

  const savePolylineLabel = () => {
    if (!labelEditDrawingId) return
    const id = labelEditDrawingId
    const label = labelDraft
    setDrawings((current) =>
      current.map((d) => (d.id === id ? { ...d, label } : d)),
    )
    setLabelEditDrawingId(null)
    if (id.startsWith('temp-')) return
    void updatePolylineArrow(id, { label }).catch(() => {
      toast.error('Failed to save label')
      void loadChartDrawings(SYMBOL, pane.id)
        .then((rows) => setDrawings(rows))
        .catch(() => {})
    })
  }

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
          {isExpanded && (
            <>
              <Button
                variant={drawTool === 'trendline' ? 'default' : 'ghost'}
                size="icon"
                aria-label={drawTool === 'trendline' ? 'Cancel trendline' : 'Draw trendline'}
                aria-pressed={drawTool === 'trendline'}
                onClick={() => toggleTool('trendline')}
              >
                <TrendingUp />
              </Button>
              <Button
                variant={drawTool === 'rectangle' ? 'default' : 'ghost'}
                size="icon"
                aria-label={drawTool === 'rectangle' ? 'Cancel rectangle' : 'Draw rectangle'}
                aria-pressed={drawTool === 'rectangle'}
                onClick={() => toggleTool('rectangle')}
              >
                <Square />
              </Button>
              <Button
                variant={drawTool === 'polyline_arrow' ? 'default' : 'ghost'}
                size="icon"
                aria-label={
                  drawTool === 'polyline_arrow' ? 'Cancel polyline arrow' : 'Draw polyline arrow'
                }
                aria-pressed={drawTool === 'polyline_arrow'}
                onClick={() => toggleTool('polyline_arrow')}
              >
                <Spline />
              </Button>
              {drawTool === 'polyline_arrow' && (
                <span className="text-xs text-muted-foreground">
                  Tap points · double-tap final point
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={iconToolActive ? 'default' : 'ghost'}
                    size="icon"
                    aria-label={iconToolActive ? 'Cancel icon placement' : 'Place chart icon'}
                    aria-pressed={iconToolActive}
                  >
                    <MapPin />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Icons</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {CHART_ICON_DEFINITIONS.map((def) => (
                    <DropdownMenuItem
                      key={def.kind}
                      onClick={() => selectIconTool(def.kind)}
                      className={drawTool === def.kind ? 'bg-accent' : undefined}
                    >
                      {def.label}
                    </DropdownMenuItem>
                  ))}
                  {iconToolActive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDrawTool(null)}>Clear tool</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedDrawingId && (
                <Button
                  variant="destructive"
                  size="icon"
                  aria-label="Delete selected drawing"
                  onClick={deleteSelectedDrawing}
                >
                  <Trash2 />
                </Button>
              )}
            </>
          )}
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
            chartType={chartType}
            onLoadOlder={loadOlder}
            axesVisible={axesVisible}
            trendlines={trendlineDrawings}
            rectangles={rectangleDrawings}
            icons={iconDrawings}
            polylines={polylineDrawings}
            forceEvents={forceEvents}
            engulfingEvents={engulfingEvents}
            drawTool={drawTool}
            onDrawingComplete={onDrawingComplete}
            onDrawingChange={onDrawingChange}
            onDrawingChangeEnd={onDrawingChangeEnd}
            onDrawingDelete={onDrawingDelete}
            onSelectionChange={setSelectedDrawingId}
            onDrawToolCancel={() => setDrawTool(null)}
            onPolylineComplete={onPolylineComplete}
            onPolylineChange={onPolylineChange}
            onPolylineChangeEnd={onPolylineChangeEnd}
            onPolylineLabelEdit={openLabelEditor}
          />
        )}
      </div>
      <Dialog
        open={labelEditDrawingId != null}
        onOpenChange={(open) => {
          if (!open) setLabelEditDrawingId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Arrow label</DialogTitle>
          </DialogHeader>
          <Input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            placeholder="Label at arrow head"
            onKeyDown={(e) => {
              if (e.key === 'Enter') savePolylineLabel()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setLabelEditDrawingId(null)}>
              Cancel
            </Button>
            <Button onClick={savePolylineLabel}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

