'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { SessionOpenTimes } from '../../_lib/chart/chart-timezone'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { regimeIndicatorVisibility } from '../../_lib/chart/chart-indicator-pane-settings'
import { PriceChart, type ChartType, type DrawTool } from '../chart/price-chart'
import { DrawingLabelSession, type DrawingLabelState } from '../chart/_sessions/configure/drawing-label-session'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { deleteChartDrawing, insertDrawing, insertPolylineArrow, insertTextAnchor, isPolylineArrowKind, isTextAnchorKind, isWarningCircleKind, loadChartDrawings, updateChartDrawingLabel, updatePolylineArrow, type ChartDrawing, type ChartDrawingKind, type DrawingPoint } from '../../_lib/chart/chart-drawings'
import { isChartIconKind, type ChartIconKind } from '../../_lib/chart/chart-icons'
import { useDebouncedDrawingPersist } from '../../_hooks/useDebouncedDrawingPersist'
import { detectBaselineEngulfing, detectBaselineForce, detectBaselineDoji, calculateForceScores, closedCandlesAt, detectKeyLevels, detectRegimeSegments, detectCurrentRegime, keyLevelVolumeBarCount } from '../../_lib/overlays/baseline-indicators'
import type { Regime } from '../../_lib/overlays/baseline-indicators'
import { detectDoublePatterns, DOUBLE_PATTERN_CONFIG } from '../../_lib/overlays/double-pattern'
import { calculateBaseLineBias, DEFAULT_BASE_LINE_BIAS_CONFIG } from '../../_lib/bias/base-line-bias'
import { mergeCandles } from '@/lib/ticks/merge'
import { CANDLE_TIMEFRAMES, type CandleTimeframe, type LightweightCandle } from '@/lib/ticks/candles'
import { alignTimeBinsToCandleOpens, volumeProfileWindowFromCandles } from '@/lib/ticks/volume-profile'
import { marketHistoryInfiniteOptions, marketRecentQueryOptions, volumeProfileQueryOptions } from '../../_lib/market-queries'
import { DEFAULT_VP_SETTINGS, volumeProfilePriceGrid, type VolumeProfileSettings } from '../../_lib/chart/volume-profile-settings'
import { buildVolumeProfile } from '../../_lib/chart/volume-profile'
import { SYMBOL, type PaneDefinition, type PaneId } from '../../_lib/workspace/workspace-layout'
import type { DrawingMode } from '../../_lib/workspace/drawing-control'
import { ChartPaneHeader } from './chart-pane-header'

export function ChartPane({
  pane,
  obscured = false,
  active, keyboardEnabled, drawingMode, onActivate, onCancelMode,
  isExpanded,
  compact,
  chartType,
  axesVisible,
  resetLayoutEpoch,
  onResetLayoutApplied,
  showVolumeProfile,
  volumeProfileSettings = DEFAULT_VP_SETTINGS,
  sessionSlotEnabled,
  sessionOpenTimes,
  showBollinger,
  showIchimoku,
  autoIndicatorsByRegime,
  onRegimeChange,
  showRegime,
  showForce,
  showEngulfing,
  showDoji,
  showDoublePattern,
  showKeyLevels,
  onChartType,
  onToggleExpand,
}: {
  pane: PaneDefinition
  obscured?: boolean
  active: boolean
  keyboardEnabled: boolean
  drawingMode: DrawingMode
  onActivate: () => void
  onCancelMode: (kind: DrawingMode['kind']) => void
  isExpanded: boolean
  compact: boolean
  chartType: ChartType
  axesVisible: boolean
  resetLayoutEpoch: number
  onResetLayoutApplied: (epoch: number) => void
  showVolumeProfile: boolean
  volumeProfileSettings?:VolumeProfileSettings
  sessionSlotEnabled: ReadonlySet<string>
  sessionOpenTimes: SessionOpenTimes
  showBollinger: boolean
  showIchimoku: boolean
  autoIndicatorsByRegime: boolean
  onRegimeChange: (paneId: PaneId, regime: Regime | null) => void
  showRegime: boolean
  showForce: boolean
  showEngulfing: boolean
  showDoji: boolean
  showDoublePattern: boolean
  showKeyLevels: boolean
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
  const closedBarsRef = useRef<{ key: string; bars: LightweightCandle[] }>({ key: '', bars: [] })
  const closedCandidate = candles.slice(0, -1)
  const closedKey = closedCandidate.length
    ? `${closedCandidate.length}:${closedCandidate[0]!.time}:${closedCandidate.at(-1)!.time}`
    : 'empty'
  if (closedBarsRef.current.key !== closedKey) {
    closedBarsRef.current = { key: closedKey, bars: closedCandidate }
  }
  const closedBars = closedBarsRef.current.bars
  const currentRegime = useMemo(() => detectCurrentRegime(closedBars), [closedBars])
  useEffect(() => {
    onRegimeChange(pane.id, currentRegime)
    return () => onRegimeChange(pane.id, null)
  }, [pane.id, currentRegime, onRegimeChange])
  const indicatorVisibility = regimeIndicatorVisibility(
    autoIndicatorsByRegime,
    currentRegime,
    { bollinger: showBollinger, ichimoku: showIchimoku },
  )
  const volumeProfileWindow = useMemo(() => {
    if (pane.id !== '15m' && pane.id !== '3m') return null
    return volumeProfileWindowFromCandles(candles, pane.id as CandleTimeframe,volumeProfileSettings.lookback)
  }, [candles, pane.id,volumeProfileSettings.lookback])
  const vpGrid=useMemo(()=>volumeProfilePriceGrid(candles,volumeProfileSettings),[candles,volumeProfileSettings])
  const vpIntervalSec =
    volumeProfileWindow?.intervalSec ??
    (pane.id === '15m' || pane.id === '3m' ? CANDLE_TIMEFRAMES[pane.id] : 900)
  const volumeProfileQuery = useQuery({
    ...(volumeProfileWindow
      ? volumeProfileQueryOptions(
          volumeProfileWindow.fromMsc,
          volumeProfileWindow.toMsc,
          vpIntervalSec,
          pane.id,
          vpGrid??undefined,
        )
      : volumeProfileQueryOptions(0, 1, vpIntervalSec, pane.id)),
    enabled: volumeProfileWindow != null && vpGrid != null && showVolumeProfile,
  })
  const keyLevelBarCount = keyLevelVolumeBarCount(pane.id)
  const keyLevelCandles = useMemo(
    () => closedCandlesAt(
      candles,
      CANDLE_TIMEFRAMES[pane.id],
      Math.floor(Date.now() / 1000),
    ),
    [candles, pane.id],
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

  const forceEvents = useMemo(
    () => showForce ? detectBaselineForce(closedBars) : [],
    [closedBars, showForce],
  )
  const forceScores = useMemo(
    () => showForce && pane.id === '3m' || pane.id === '15m' ? calculateForceScores(closedBars) : [],
    [closedBars, pane.id, showForce],
  )
  const engulfingEvents = useMemo(
    () => showEngulfing ? detectBaselineEngulfing(closedBars) : [],
    [closedBars, showEngulfing],
  )
  const dojiEvents = useMemo(
    () => (showDoji ? detectBaselineDoji(closedBars) : []),
    [closedBars, showDoji],
  )
  const doublePatterns = useMemo(
    () => showDoublePattern
      ? detectDoublePatterns(closedBars).filter((pattern) =>
        pattern.state === 'CONFIRMED' && pattern.score >= DOUBLE_PATTERN_CONFIG.minScore)
      : [],
    [closedBars, showDoublePattern],
  )
  const regimeSegments = useMemo(
    () => showRegime ? detectRegimeSegments(closedBars) : [],
    [closedBars, showRegime],
  )
  const keyLevels = useMemo(() => {
    if (!showKeyLevels) return []
    return detectKeyLevels(keyLevelCandles.slice(-keyLevelBarCount))
  }, [keyLevelBarCount, keyLevelCandles, showKeyLevels])

  const volumeProfile = useMemo(() => {
    if (!showVolumeProfile || (pane.id !== '15m' && pane.id !== '3m')) return null
    if (!vpGrid || volumeProfileQuery.isPlaceholderData) return null
    const payload = volumeProfileQuery.data
    const window = volumeProfileWindow
    const timeBins = window
      ? alignTimeBinsToCandleOpens(
          payload?.time ?? [],
          window.candleTimes,
          window.intervalSec,
        )
      : (payload?.time ?? [])
    return buildVolumeProfile(payload?.price ?? [], {
      timeBins,
      intervalSec: vpIntervalSec,
      binSize:vpGrid.binSize,
    })
  }, [showVolumeProfile, pane.id, volumeProfileQuery.data, volumeProfileWindow, vpIntervalSec,vpGrid,volumeProfileQuery.isPlaceholderData])

  const drawTool: DrawTool = drawingMode.kind === 'draw' ? drawingMode.tool : null
  const measureActive = drawingMode.kind === 'measure'
  const [drawings, setDrawings] = useState<ChartDrawing[]>([])
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null)
  const pendingTextRef = useRef<{ id: string; point: DrawingPoint } | null>(null)
  const labelSessionRef = useRef<DrawingLabelSession | null>(null)
  if (!labelSessionRef.current) labelSessionRef.current = new DrawingLabelSession()
  const [labelState, setLabelState] = useState<DrawingLabelState>({ status: 'closed' })
  const labelEditDrawingId = labelState.status === 'editing' ? labelState.id : null
  const labelDraft = labelState.status === 'editing' ? labelState.draft : ''
  const openLabelSession = (input: { id: string; kind: string | null; label: string }) => {
    labelSessionRef.current!.open(input)
    setLabelState(labelSessionRef.current!.state)
  }
  const cancelLabelSession = () => {
    pendingTextRef.current = null
    labelSessionRef.current!.cancel()
    setLabelState(labelSessionRef.current!.state)
  }
  const { queuePersist, commitPersist, queuePolylinePersist, commitPolylinePersist } =
    useDebouncedDrawingPersist(pane.id, setDrawings)


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
  const fibonacciRangeDrawings = useMemo(
    () =>
      drawings
        .filter((d) => d.kind === 'fibonacci_range')
        .map((d) => ({ id: d.id, p1: d.p1, p2: d.p2 })),
    [drawings],
  )
  const parallelChannelDrawings=useMemo(()=>drawings.filter(d=>d.kind==='parallel_channel'&&d.points?.length===3).map(d=>({id:d.id,points:d.points as [DrawingPoint,DrawingPoint,DrawingPoint]})),[drawings])
  const fibonacciExtensionDrawings = useMemo(
    () => drawings
      .filter((d) => d.kind === 'fibonacci_range_extension' && d.points?.length === 3)
      .map((d) => ({ id: d.id, points: d.points as [DrawingPoint, DrawingPoint, DrawingPoint] })),
    [drawings],
  )
  const warningCircleDrawings = useMemo(
    () =>
      drawings
        .filter((d) => d.kind === 'warning_circle')
        .map((d) => ({ id: d.id, p1: d.p1, p2: d.p2, label: d.label })),
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
  const textAnchorDrawings = useMemo(
    () =>
      drawings
        .filter((d) => isTextAnchorKind(d.kind))
        .map((d) => ({ id: d.id, p1: d.p1, label: d.label })),
    [drawings],
  )

  const labelEditDrawing = labelEditDrawingId
    ? drawings.find((d) => d.id === labelEditDrawingId)
    : null
  const labelEditIsText = labelState.status === 'editing' && labelState.kind === 'text_anchor'
  const labelEditIsCircle =
    labelEditDrawing != null && isWarningCircleKind(labelEditDrawing.kind)

  const onDrawingComplete = (input: {
    kind: ChartDrawingKind
    p1: DrawingPoint
    p2: DrawingPoint
    points?: DrawingPoint[]
  }) => {
    if (isTextAnchorKind(input.kind)) {
      onCancelMode('draw')
      const id = 'temp-' + crypto.randomUUID()
      pendingTextRef.current = { id, point: input.p1 }
      openLabelSession({ id, kind: 'text_anchor', label: '' })
      return
    }
    if (
      !isChartIconKind(input.kind) &&
      !isPolylineArrowKind(input.kind)
    ) {
      onCancelMode('draw')
    }
    const anchor = input.p1
    const tempId = `temp-${Date.now()}`
    const pointAnchor =
      isChartIconKind(input.kind) ? anchor : input.p2
    const optimistic: ChartDrawing = {
      id: tempId,
      symbol: SYMBOL,
      timeframe: pane.id,
      kind: input.kind,
      p1: anchor,
      p2: pointAnchor,
      ...(input.points ? { points: input.points } : {}),
    }
    setDrawings((current) => [...current, optimistic])
    const persist = insertDrawing({
          symbol: SYMBOL,
          timeframe: pane.id,
          kind: input.kind,
          p1: anchor,
          p2: pointAnchor,
          points: input.points,
        })
    void persist
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
    onCancelMode('draw')
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
    openLabelSession({ id, kind: drawing?.kind ?? null, label: drawing?.label ?? '' })
  }

  const saveDrawingLabel = () => {
    const result = labelSessionRef.current!.save()
    if (!result) return
    setLabelState(labelSessionRef.current!.state)
    const { id, label } = result
    const pending = pendingTextRef.current
    if (pending?.id === id) {
      pendingTextRef.current = null
      const text = label.trim()
      if (!text) return
      const optimistic: ChartDrawing = { id, symbol: SYMBOL, timeframe: pane.id, kind: 'text_anchor', p1: pending.point, p2: pending.point, label: text }
      setDrawings(current => [...current, optimistic])
      void insertTextAnchor({ symbol: SYMBOL, timeframe: pane.id, p1: pending.point, label: text }).then(saved => {
        setDrawings(current => current.map(d => d.id === id ? saved : d))
      }).catch(() => { setDrawings(current => current.filter(d => d.id !== id)); toast.error('Failed to save text anchor') })
      return
    }
    const drawing = drawings.find((d) => d.id === id)
    setDrawings((current) =>
      current.map((d) => (d.id === id ? { ...d, label } : d)),
    )
    if (id.startsWith('temp-')) return
    const persist =
      drawing &&
      (isTextAnchorKind(drawing.kind) || isWarningCircleKind(drawing.kind))
        ? updateChartDrawingLabel(id, label)
        : updatePolylineArrow(id, { label })
    void persist.catch(() => {
      toast.error('Failed to save label')
      void loadChartDrawings(SYMBOL, pane.id)
        .then((rows) => setDrawings(rows))
        .catch(() => {})
    })
  }

  return (
    <section
      data-chart-pane={pane.id}
      data-pane-obscured={obscured ? 'true' : undefined}
      data-pane-expanded={isExpanded ? 'true' : undefined}
      inert={obscured}
      aria-hidden={obscured || undefined}
      data-chart-bias={bias ?? undefined}
      data-active-chart={active ? 'true' : undefined}
      onPointerDownCapture={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-pane-header]')) onActivate()
      }}
      onFocusCapture={(event) => {
        if (!(event.target instanceof Element) || !event.target.closest('[data-pane-header]')) onActivate()
      }}
      className={
        isExpanded
          ? 'absolute inset-0 z-30 flex h-full min-h-0 w-full flex-col overflow-hidden border-0 bg-background'
          : 'relative flex min-h-0 min-w-0 flex-col overflow-hidden border-0'
      }
    >
      <ChartPaneHeader
        pane={pane} compact={compact} isExpanded={isExpanded} chartType={chartType}
        bias={bias} active={active} onActivate={onActivate}
        selectedDrawingId={active ? selectedDrawingId : null} onChartType={onChartType}
        deleteSelectedDrawing={deleteSelectedDrawing}
        onToggleExpand={onToggleExpand}
      />
      <div data-chart-content className={compact ? 'absolute inset-0 z-0' : 'relative z-0 min-h-0 flex-1'}>
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
            timeframe={pane.id}
            onLoadOlder={loadOlder}
            axesVisible={axesVisible}
            resetLayoutEpoch={resetLayoutEpoch}
            onResetLayoutApplied={onResetLayoutApplied}
            trendlines={trendlineDrawings}
            rectangles={rectangleDrawings}
            fibonacciRanges={fibonacciRangeDrawings}
            fibonacciExtensions={fibonacciExtensionDrawings}
            parallelChannels={parallelChannelDrawings}
            warningCircles={warningCircleDrawings}
            icons={iconDrawings}
            polylines={polylineDrawings}
            textAnchors={textAnchorDrawings}
            forceEvents={forceEvents}
            forceScores={forceScores}
            engulfingEvents={engulfingEvents}
            dojiEvents={dojiEvents}
            doublePatterns={doublePatterns}
            regimeSegments={regimeSegments}
            keyLevels={keyLevels}
            volumeProfile={volumeProfile}
            sessionSlotEnabled={sessionSlotEnabled}
            sessionOpenTimes={sessionOpenTimes}
            showBollinger={indicatorVisibility.bollinger}
            showIchimoku={indicatorVisibility.ichimoku}
            keyboardActive={active && keyboardEnabled}
            drawTool={drawTool}
            measureActive={measureActive}
            onDrawingComplete={onDrawingComplete}
            onDrawingChange={onDrawingChange}
            onDrawingChangeEnd={onDrawingChangeEnd}
            onDrawingDelete={onDrawingDelete}
            onSelectionChange={setSelectedDrawingId}
            onDrawToolCancel={() => onCancelMode('draw')}
            onMeasureCancel={() => onCancelMode('measure')}
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
          if (!open) cancelLabelSession()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {labelEditIsText
                ? 'Text anchor'
                : labelEditIsCircle
                  ? 'Warning circle label'
                  : 'Arrow label'}
            </DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            className="text-base"
            value={labelDraft}
            onChange={(e) => {
              labelSessionRef.current!.changeDraft(e.target.value)
              setLabelState(labelSessionRef.current!.state)
            }}
            placeholder={
              labelEditIsText
                ? 'Text at anchor'
                : labelEditIsCircle
                  ? 'Label at circle center'
                  : 'Label at arrow head'
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && (!labelEditIsText || labelDraft.trim())) saveDrawingLabel()
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={cancelLabelSession}>
              Cancel
            </Button>
            <Button disabled={labelEditIsText && !labelDraft.trim()} onClick={saveDrawingLabel}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

