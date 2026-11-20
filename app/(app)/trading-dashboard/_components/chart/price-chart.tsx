'use client'

import { useEffect, useRef, useState } from 'react'
import type { IChartApi, ITimeScaleApi, LogicalRange, Time } from 'lightweight-charts'
import { useDebounceCallback } from 'usehooks-ts'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { CandleTimeframe, LightweightCandle } from '@/lib/ticks/candles'
import {
  type ChartDrawingKind,
  type DrawingPoint,
} from '../../_lib/chart/chart-drawings'
import type { BarTimeSeries } from '../../_lib/chart/chart-coordinates'
import {
  chartCoordinateBars,
  futureBarTimesUntilChartZoneEod,
} from '../../_lib/chart/extend-candles-to-chart-eod'
import { diffCandles } from '../../_lib/chart/candle-sync-diff'
import { VIEWPORT } from '../../_lib/chart/price-chart-style'
import { defaultChartLayout } from '../../_lib/chart/chart-default-layout'
import {
  readViewport,
  writeViewport,
  type PersistedChartViewport,
} from '../../_lib/chart/chart-viewport-storage'
import { ichimokuForChart } from '../../_lib/chart/price-chart-ichimoku'
import { bollinger, pricePoint, type BandLevel, type ChartType } from '../../_lib/chart/price-chart-series'
import type { EngulfingOverlayEvent } from './_components/indicators/engulfing/engulfing-overlay-primitive'
import type { DojiOverlayEvent } from './_components/indicators/doji/doji-overlay-primitive'
import type { ForceOverlayEvent } from './_components/indicators/force/force-overlay-primitive'
import type { VolumeProfileFrame } from '../../_lib/chart/volume-profile'
import type { ForceScorePoint, KeyLevelZone, RegimeSegment } from '../../_lib/overlays/baseline-indicators'
import type { IconMarkerDrawing } from './_components/objects/icon/icon-marker-primitive'
import type { RectangleDrawing } from './_components/objects/rect/rectangle-primitive'
import type { FibonacciRangeExtensionDrawing } from './_components/objects/fibonacci-extension/fibonacci-range-extension-primitive'
import type { FibonacciRangeDrawing } from './_components/objects/fibonacci-range/fibonacci-range-primitive'
import type { PolylineArrowDrawing } from './_components/objects/polyline/polyline-arrow-primitive'
import type { TextAnchorDrawing } from './_components/objects/text/text-anchor-primitive'
import type { TrendlineDrawing } from './_components/objects/trendline/trendline-primitive'
import type { WarningCircleDrawing } from './_components/objects/warning-circle/warning-circle-primitive'
import {
  reducePriceMeasurement,
  type PriceMeasurementPoint,
  type PriceMeasurementState,
} from './_components/objects/measure/price-measurement'
import {
  bindPriceChartInteraction,
  isTouchSeedShapeTool,
  isTwoPointDrawTool,
} from './bind-price-chart-interaction'
import type { ChartEditRuntime } from './_sessions/edit/chart-edit-runtime'
import type { ChartSelectionRuntime } from './_sessions/edit/chart-selection-runtime'
import { applyShapeDraft, clearDrawingDrafts } from './drawing-draft-adapter'
import type { TwoPointToolKind } from './_sessions/create/two-point-create-behavior'
import {
  initPriceChart,
  syncDrawingBars,
  type ChartHandle,
} from './price-chart-handle'

export type { ChartType }
export type DrawTool = ChartDrawingKind | null

type ViewportSnapshot = {
  timeframe: string
  range: LogicalRange
  barSpacing: number
  rightOffset: number
}

function timeToUnix(time: Time): number | null {
  return typeof time === 'number' && Number.isFinite(time) ? time : null
}

function capturePersistedViewport(chart: IChartApi): PersistedChartViewport | null {
  const scale = chart.timeScale()
  const timeRange = scale.getVisibleRange()
  if (!timeRange) return null
  const from = timeToUnix(timeRange.from)
  const to = timeToUnix(timeRange.to)
  if (from == null || to == null || to <= from) return null
  const opts = scale.options()
  return {
    from,
    to,
    barSpacing: opts.barSpacing,
    rightOffset: opts.rightOffset,
  }
}

function emptyBandLevels(length: number): (BandLevel | null)[] {
  return Array.from({ length }, () => null)
}

function applyIndicatorVisibility(
  handle: ChartHandle,
  showBollinger: boolean,
  showIchimoku: boolean,
): void {
  handle.upper.applyOptions({ visible: showBollinger })
  handle.middle.applyOptions({ visible: showBollinger })
  handle.lower.applyOptions({ visible: showBollinger })
  handle.ichimokuConversion.applyOptions({ visible: showIchimoku })
  handle.ichimokuBase.applyOptions({ visible: showIchimoku })
}

function syncBollingerBandData(
  handle: ChartHandle,
  candles: readonly LightweightCandle[],
  showBollinger: boolean,
): void {
  if (!showBollinger) {
    handle.upper.setData([])
    handle.middle.setData([])
    handle.lower.setData([])
    return
  }
  const bands = bollinger(candles)
  handle.upper.setData(bands.upper)
  handle.middle.setData(bands.middle)
  handle.lower.setData(bands.lower)
}

function syncIchimokuSeries(
  handle: ChartHandle,
  candles: readonly LightweightCandle[],
  tf: CandleTimeframe,
  showIchimoku: boolean,
): void {
  if (!showIchimoku) {
    handle.ichimokuConversion.setData([])
    handle.ichimokuBase.setData([])
    handle.ichimokuCloud.setCloud([])
    return
  }
  const ichi = ichimokuForChart(candles, tf)
  handle.ichimokuConversion.setData(ichi.conversion)
  handle.ichimokuBase.setData(ichi.base)
  handle.ichimokuCloud.setCloud(ichi.cloud)
}

function applyPersistedViewport(
  scale: ITimeScaleApi<Time>,
  viewport: PersistedChartViewport,
): void {
  scale.applyOptions({
    barSpacing: viewport.barSpacing,
    rightOffset: viewport.rightOffset,
  })
  scale.setVisibleRange({
    from: viewport.from as Time,
    to: viewport.to as Time,
  })
}

export function PriceChart({
  candles,
  chartType,
  timeframe,
  onLoadOlder,
  axesVisible,
  resetLayoutEpoch = 0,
  onResetLayoutApplied,
  trendlines = [],
  rectangles = [],
  fibonacciRanges = [],
  fibonacciExtensions = [],
  warningCircles = [],
  icons = [],
  polylines = [],
  textAnchors = [],
  forceEvents = [],
  engulfingEvents = [],
  dojiEvents = [],
  regimeSegments = [],
  keyLevels = [],
  forceScores = [],
  volumeProfile = null,
  sessionSlotEnabled = null,
  showBollinger = true,
  showIchimoku = false,
  drawTool = null,
  measureActive = false,
  onDrawingComplete,
  onDrawingChange,
  onDrawingChangeEnd,
  onDrawingDelete,
  onSelectionChange,
  onDrawToolCancel,
  onMeasureCancel,
  onPolylineComplete,
  onPolylineChange,
  onPolylineChangeEnd,
  onPolylineLabelEdit,
}: {
  candles: LightweightCandle[]
  chartType: ChartType
  timeframe: string
  onLoadOlder?: () => void
  axesVisible: boolean
  resetLayoutEpoch?: number
  onResetLayoutApplied?: (epoch: number) => void
  trendlines?: readonly TrendlineDrawing[]
  rectangles?: readonly RectangleDrawing[]
  fibonacciRanges?: readonly FibonacciRangeDrawing[]
  fibonacciExtensions?: readonly FibonacciRangeExtensionDrawing[]
  warningCircles?: readonly WarningCircleDrawing[]
  icons?: readonly IconMarkerDrawing[]
  polylines?: readonly PolylineArrowDrawing[]
  textAnchors?: readonly TextAnchorDrawing[]
  forceEvents?: readonly ForceOverlayEvent[]
  engulfingEvents?: readonly EngulfingOverlayEvent[]
  dojiEvents?: readonly DojiOverlayEvent[]
  regimeSegments?: readonly RegimeSegment[]
  keyLevels?: readonly KeyLevelZone[]
  forceScores?: readonly ForceScorePoint[]
  volumeProfile?: VolumeProfileFrame | null
  /** null = all session slots; otherwise only these slot ids are drawn. */
  sessionSlotEnabled?: ReadonlySet<string> | null
  showBollinger?: boolean
  showIchimoku?: boolean
  drawTool?: DrawTool
  measureActive?: boolean
  onDrawingComplete?: (input: {
    kind: ChartDrawingKind
    p1: DrawingPoint
    p2: DrawingPoint
    points?: DrawingPoint[]
  }) => void
  onDrawingChange?: (id: string, p1: DrawingPoint, p2: DrawingPoint) => void
  onDrawingChangeEnd?: (id: string) => void
  onDrawingDelete?: (id: string) => void
  onSelectionChange?: (id: string | null) => void
  onDrawToolCancel?: () => void
  onMeasureCancel?: () => void
  onPolylineComplete?: (input: { points: DrawingPoint[] }) => void
  onPolylineChange?: (id: string, points: DrawingPoint[]) => void
  onPolylineChangeEnd?: (id: string) => void
  onPolylineLabelEdit?: (id: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const appliedResetLayoutEpochRef = useRef(0)
  const drawOverlayRef = useRef<HTMLDivElement>(null)
  const pointerCaptureElRef = useRef<HTMLElement | null>(null)
  const handleRef = useRef<ChartHandle | null>(null)
  const [pointerCoarse, setPointerCoarse] = useState(false)
  const candlesRef = useRef<BarTimeSeries>(candles ?? [])
  const appliedCandlesRef = useRef<LightweightCandle[]>([])
  const indicatorToggleRef = useRef({ showBollinger, showIchimoku })
  const appliedEpochRef = useRef(-1)
  const onLoadOlderRef = useRef(onLoadOlder)
  const axesVisibleRef = useRef(axesVisible)
  const drawToolRef = useRef(drawTool)
  const measureActiveRef = useRef(measureActive)
  const measurementStateRef = useRef<PriceMeasurementState>({ status: 'idle' })
  const cancelMeasurementRef = useRef<(() => void) | null>(null)
  const seedCoarseTwoPointRef = useRef<((tool: TwoPointToolKind) => boolean) | null>(null)
  const seedCoarseThreePointRef = useRef<(() => boolean) | null>(null)
  const interactionCancelRef = useRef<(() => void) | null>(null)
  const editSessionRef = useRef<ChartEditRuntime | null>(null)
  const selectionSessionRef = useRef<ChartSelectionRuntime | null>(null)
  const pointerCoarseRef = useRef(false)
  const chartElRef = useRef<HTMLElement | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const trendlinesRef = useRef(trendlines)
  const rectanglesRef = useRef(rectangles)
  const fibonacciRangesRef = useRef(fibonacciRanges)
  const fibonacciExtensionsRef = useRef(fibonacciExtensions)
  const warningCirclesRef = useRef(warningCircles)
  const iconsRef = useRef(icons)
  const polylinesRef = useRef(polylines)
  const textAnchorsRef = useRef(textAnchors)
  const onCompleteRef = useRef(onDrawingComplete)
  const onChangeRef = useRef(onDrawingChange)
  const onChangeEndRef = useRef(onDrawingChangeEnd)
  const onDeleteRef = useRef(onDrawingDelete)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const onDrawToolCancelRef = useRef(onDrawToolCancel)
  const onMeasureCancelRef = useRef(onMeasureCancel)
  const onPolylineCompleteRef = useRef(onPolylineComplete)
  const onPolylineChangeRef = useRef(onPolylineChange)
  const onPolylineChangeEndRef = useRef(onPolylineChangeEnd)
  const onPolylineLabelEditRef = useRef(onPolylineLabelEdit)
  const [epoch, setEpoch] = useState(0)
  const viewportSnapshotRef = useRef<ViewportSnapshot | null>(null)
  const restoringViewportRef = useRef(false)
  const timeframeRef = useRef(timeframe)
  timeframeRef.current = timeframe
  const persistViewport = useDebounceCallback(() => {
    if (restoringViewportRef.current) return
    const handle = handleRef.current
    if (!handle?.fitted) return
    const snap = capturePersistedViewport(handle.chart)
    if (snap) writeViewport(timeframeRef.current, snap)
  }, 300)
  const persistViewportRef = useRef(persistViewport)
  persistViewportRef.current = persistViewport
  trendlinesRef.current = trendlines
  rectanglesRef.current = rectangles
  fibonacciRangesRef.current = fibonacciRanges
  fibonacciExtensionsRef.current = fibonacciExtensions
  warningCirclesRef.current = warningCircles
  iconsRef.current = icons
  polylinesRef.current = polylines
  textAnchorsRef.current = textAnchors
  onLoadOlderRef.current = onLoadOlder
  axesVisibleRef.current = axesVisible
  drawToolRef.current = drawTool
  measureActiveRef.current = measureActive
  onCompleteRef.current = onDrawingComplete
  onChangeRef.current = onDrawingChange
  onChangeEndRef.current = onDrawingChangeEnd
  onDeleteRef.current = onDrawingDelete
  onSelectionChangeRef.current = onSelectionChange
  onDrawToolCancelRef.current = onDrawToolCancel
  onMeasureCancelRef.current = onMeasureCancel
  onPolylineCompleteRef.current = onPolylineComplete
  onPolylineChangeRef.current = onPolylineChange
  onPolylineChangeEndRef.current = onPolylineChangeEnd
  onPolylineLabelEditRef.current = onPolylineLabelEdit

  const setPolylineDraft = (
    points: DrawingPoint[],
    previewPoint?: DrawingPoint | null,
  ) => {
    const handle = handleRef.current
    if (!handle) return
    handle.polylines.setDraft(
      previewPoint ? { points, previewPoint } : points.length > 0 ? { points } : null,
    )
  }

  const syncDrawOverlay = () => {
    const overlay = drawOverlayRef.current
    if (!overlay) return
    const interacting = drawToolRef.current != null || measureActiveRef.current
    overlay.style.pointerEvents = interacting ? 'auto' : 'none'
  }

  const syncInteractionLock = () => {
    const handle = handleRef.current
    if (!handle) return
    const drawing = drawToolRef.current != null
    const dragging = editSessionRef.current?.isDragging ?? false
    const locked = drawing || measureActiveRef.current || dragging
    handle.chart.applyOptions({
      handleScroll: !locked,
      handleScale: !locked,
      kineticScroll: { mouse: !locked, touch: !locked },
      crosshair: { mode: locked ? 2 : 1 },
    })
    const el = chartElRef.current
    if (el) el.style.touchAction = locked ? 'none' : 'manipulation'
    syncDrawOverlay()
  }

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const update = () => {
      pointerCoarseRef.current = mq.matches
      setPointerCoarse(mq.matches)
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const selectDrawing = (id: string | null) => {
    const changed = selectedIdRef.current !== id
    selectedIdRef.current = id
    const handle = handleRef.current
    handle?.trendlines.setSelectedId(id)
    handle?.rectangles.setSelectedId(id)
    handle?.fibonacciRanges.setSelectedId(id)
    handle?.fibonacciExtensions.setSelectedId(id)
    handle?.warningCircles.setSelectedId(id)
    handle?.icons.setSelectedId(id)
    handle?.polylines.setSelectedId(id)
    handle?.textAnchors.setSelectedId(id)
    if (changed) onSelectionChangeRef.current?.(id)
  }

  const clearDrafts = () => {
    selectionSessionRef.current?.reset()
    const handle = handleRef.current
    if (handle) clearDrawingDrafts(handle)
  }

  const releaseActivePointerCapture = () => {
    const el = pointerCaptureElRef.current
    const pointerId = selectionSessionRef.current?.activePointerId
    pointerCaptureElRef.current = null
    selectionSessionRef.current?.resetPointer()
    if (el && pointerId != null) {
      try { el.releasePointerCapture(pointerId) } catch { /* lost capture */ }
    }
  }

  const cancelDrawTool = () => {
    if (!drawToolRef.current) return
    editSessionRef.current?.cancelActive()
    releaseActivePointerCapture()
    interactionCancelRef.current?.()
    clearDrafts()
    onDrawToolCancelRef.current?.()
    syncInteractionLock()
  }

  const setShapeDraft = (p1: DrawingPoint, p2?: DrawingPoint | null, p3?: DrawingPoint | null) => {
    const handle = handleRef.current
    if (handle) applyShapeDraft(handle, drawToolRef.current, { p1, p2: p2 ?? undefined, p3: p3 ?? undefined })
  }
  const setShapeDraftRef = useRef(setShapeDraft)
  setShapeDraftRef.current = setShapeDraft

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let cancelled = false
    let createdChart: IChartApi | null = null
    let removePointerHandlers: (() => void) | null = null
    let unsubscribeRange: (() => void) | null = null

    void import('lightweight-charts').then((lwc) => {
      if (cancelled || !ref.current) return

      const { handle, chartEl } = initPriceChart(lwc, ref.current, {
        chartType,
        timeframe,
        axesVisible: axesVisibleRef.current,
        onLoadOlder: () => onLoadOlderRef.current?.(),
      })
      createdChart = handle.chart

      if (cancelled) {
        handle.indicators.detach()
        handle.chart.remove()
        return
      }

      handleRef.current = handle
      syncDrawingBars(handle, candlesRef.current)
      removePointerHandlers = bindPriceChartInteraction({
        handle,
        chartEl,
        overlayEl: drawOverlayRef.current,
        refs: {
          drawToolRef,
          seedCoarseTwoPointRef,
          seedCoarseThreePointRef,
          interactionCancelRef,
          editSessionRef,
          selectionSessionRef,
          pointerCoarseRef,
          pointerCaptureElRef,
          chartElRef,
          selectedIdRef,
          candlesRef,
          trendlinesRef,
          rectanglesRef,
          fibonacciRangesRef,
          fibonacciExtensionsRef,
          iconsRef,
          textAnchorsRef,
          warningCirclesRef,
          polylinesRef,
          setShapeDraftRef,
          onCompleteRef,
          onChangeRef,
          onChangeEndRef,
          onPolylineCompleteRef,
          onPolylineChangeRef,
          onPolylineChangeEndRef,
          onPolylineLabelEditRef,
        },
        helpers: {
          clearDrafts,
          selectDrawing,
          setShapeDraft,
          syncInteractionLock,
          setPolylineDraft,
          syncDrawOverlay,
        },
      })

      if (cancelled) {
        removePointerHandlers()
        handle.indicators.detach()
        handle.chart.remove()
        return
      }

      const onVisibleRangeChange = () => {
        persistViewportRef.current()
      }
      handle.chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange)
      unsubscribeRange = () => {
        handle.chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange)
      }

      setEpoch((value) => value + 1)
    })

    return () => {
      cancelled = true
      persistViewportRef.current.flush()
      unsubscribeRange?.()
      removePointerHandlers?.()
      const handle = handleRef.current
      if (handle?.fitted) {
        const scale = handle.chart.timeScale()
        const range = scale.getVisibleLogicalRange()
        if (range) {
          const opts = scale.options()
          viewportSnapshotRef.current = {
            timeframe,
            range,
            barSpacing: opts.barSpacing,
            rightOffset: opts.rightOffset,
          }
        }
        const persisted = capturePersistedViewport(handle.chart)
        if (persisted) writeViewport(timeframe, persisted)
      }
      handle?.indicators.detach()
      handleRef.current = null
      selectedIdRef.current = null
      createdChart?.remove()
    }
  }, [chartType, timeframe])

  useEffect(() => {
    handleRef.current?.chart.applyOptions({
      timeScale: { visible: axesVisible },
      rightPriceScale: { visible: axesVisible },
    })
  }, [axesVisible, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.trendlines.setLines(trendlines)
  }, [trendlines, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.rectangles.setRects(rectangles)
  }, [rectangles, epoch])

  useEffect(() => {
    handleRef.current?.fibonacciExtensions.setExtensions(fibonacciExtensions)
  }, [fibonacciExtensions, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.fibonacciRanges.setRanges(fibonacciRanges)
  }, [fibonacciRanges, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.warningCircles.setCircles(warningCircles)
  }, [warningCircles, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.icons.setIcons(icons)
  }, [icons, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.polylines.setPolylines(polylines)
  }, [polylines, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.textAnchors.setAnchors(textAnchors)
  }, [textAnchors, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.indicators.setForceEvents(forceEvents)
  }, [forceEvents, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.indicators.setEngulfingEvents(engulfingEvents)
  }, [engulfingEvents, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.indicators.setDojiEvents(dojiEvents)
  }, [dojiEvents, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.indicators.setRegimeSegments(regimeSegments)
  }, [regimeSegments, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.indicators.setKeyLevels(keyLevels)
  }, [keyLevels, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.indicators.setForceScores(forceScores)
  }, [forceScores, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.indicators.setVolumeProfile(volumeProfile)
  }, [volumeProfile, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.indicators.setSessionSlots(sessionSlotEnabled)
  }, [sessionSlotEnabled, epoch])

  useEffect(() => {
    const handle = handleRef.current
    const overlay = drawOverlayRef.current
    if (!handle || !overlay) return

    const setMeasurementState = (state: PriceMeasurementState) => {
      measurementStateRef.current = state
      handle.measurement.setState(state)
    }
    const cancelMeasurement = (notify: boolean) => {
      setMeasurementState({ status: 'idle' })
      if (notify) onMeasureCancelRef.current?.()
    }
    cancelMeasurementRef.current = () => cancelMeasurement(true)

    if (!measureActive) {
      cancelMeasurement(false)
      syncInteractionLock()
      syncDrawOverlay()
      return () => {
        cancelMeasurementRef.current = null
      }
    }

    selectDrawing(null)
    const rect = () => overlay.getBoundingClientRect()
    const pointAt = (x: number, y: number): PriceMeasurementPoint | null => {
      const price = handle.price.coordinateToPrice(y)
      if (price == null || !Number.isFinite(Number(price))) return null
      return { x, price: Number(price) }
    }
    const bounds = rect()
    const center = pointAt(bounds.width / 2, bounds.height / 2)
    if (!center) {
      cancelMeasurement(true)
      return () => {
        cancelMeasurementRef.current = null
      }
    }
    setMeasurementState(
      pointerCoarseRef.current
        ? {
            status: 'placing',
            pointer: 'coarse',
            phase: 'placing_p1',
            start: center,
            end: center,
          }
        : { status: 'armed', pointer: 'fine' },
    )
    syncInteractionLock()
    syncDrawOverlay()

    let gesture: {
      pointerId: number
      clientX: number
      clientY: number
      origin: { x: number; y: number }
      moved: boolean
    } | null = null

    const localPoint = (event: PointerEvent) => {
      const box = rect()
      return { x: event.clientX - box.left, y: event.clientY - box.top }
    }
    const dispatch = (event: Parameters<typeof reducePriceMeasurement>[1]) => {
      setMeasurementState(reducePriceMeasurement(measurementStateRef.current, event))
    }
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault()
      if (measurementStateRef.current.status === 'complete') return
      const state = measurementStateRef.current
      const active = state.status === 'placing'
        ? state.pointer === 'coarse' && state.phase === 'placing_p1'
          ? state.start
          : state.end
        : null
      const activeY = active ? handle.price.priceToCoordinate(active.price) : null
      const point = localPoint(event)
      gesture = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        origin: active && activeY != null ? { x: active.x, y: Number(activeY) } : point,
        moved: false,
      }
      try { overlay.setPointerCapture(event.pointerId) } catch { /* capture may be unavailable */ }
    }
    const onPointerMove = (event: PointerEvent) => {
      event.preventDefault()
      const state = measurementStateRef.current
      if (state.status === 'placing' && state.pointer === 'fine') {
        const point = localPoint(event)
        const mapped = pointAt(point.x, point.y)
        if (mapped) dispatch({ type: 'move', point: mapped })
        return
      }
      if (!gesture || gesture.pointerId !== event.pointerId || state.status !== 'placing' || state.pointer !== 'coarse') return
      const dx = event.clientX - gesture.clientX
      const dy = event.clientY - gesture.clientY
      if (!gesture.moved && Math.hypot(dx, dy) <= 12) return
      gesture.moved = true
      const mapped = pointAt(gesture.origin.x + dx, gesture.origin.y + dy)
      if (mapped) dispatch({ type: 'move', point: mapped })
    }
    const release = (event: PointerEvent) => {
      try { overlay.releasePointerCapture(event.pointerId) } catch { /* capture may already be lost */ }
    }
    const onPointerUp = (event: PointerEvent) => {
      event.preventDefault()
      release(event)
      const state = measurementStateRef.current
      if (state.status === 'complete') {
        gesture = null
        cancelMeasurement(true)
        return
      }
      const currentGesture = gesture
      gesture = null
      if (state.status === 'placing' && state.pointer === 'coarse') {
        if (!currentGesture || currentGesture.pointerId !== event.pointerId || currentGesture.moved) return
        if (state.phase === 'placing_p1') {
          const startY = handle.price.priceToCoordinate(state.start.price)
          if (startY == null) return
          const candidateY = Number(startY) > 56 ? Number(startY) - 48 : Number(startY) + 48
          const defaultEnd = pointAt(state.start.x, candidateY)
          if (defaultEnd) dispatch({ type: 'confirm', point: defaultEnd })
          return
        }
        dispatch({ type: 'confirm', point: state.end })
        return
      }
      const point = localPoint(event)
      const mapped = pointAt(point.x, point.y)
      if (mapped) dispatch({ type: 'confirm', point: mapped })
    }
    const onPointerCancel = (event: PointerEvent) => {
      release(event)
      gesture = null
      cancelMeasurement(true)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancelMeasurement(true)
    }

    overlay.addEventListener('pointerdown', onPointerDown, { passive: false })
    overlay.addEventListener('pointermove', onPointerMove, { passive: false })
    overlay.addEventListener('pointerup', onPointerUp, { passive: false })
    overlay.addEventListener('pointercancel', onPointerCancel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      overlay.removeEventListener('pointerdown', onPointerDown)
      overlay.removeEventListener('pointermove', onPointerMove)
      overlay.removeEventListener('pointerup', onPointerUp)
      overlay.removeEventListener('pointercancel', onPointerCancel)
      window.removeEventListener('keydown', onKeyDown)
      gesture = null
      setMeasurementState({ status: 'idle' })
      cancelMeasurementRef.current = null
    }
  }, [measureActive, epoch])

  useEffect(() => {
    editSessionRef.current?.cancelActive()
    releaseActivePointerCapture()
    interactionCancelRef.current?.()
    clearDrafts()
    if (drawTool) selectDrawing(null)
    if (
      isTouchSeedShapeTool(drawTool) &&
      pointerCoarseRef.current &&
      handleRef.current
    ) {
      if (isTwoPointDrawTool(drawTool)) {
        seedCoarseTwoPointRef.current?.(drawTool)
      } else if (drawTool === 'fibonacci_range_extension') {
        seedCoarseThreePointRef.current?.()
      }
    }
  }, [drawTool, measureActive, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    syncInteractionLock()
    const drawing = drawTool != null
    handle.trendlines.setSelectionEnabled(!drawing)
    handle.rectangles.setSelectionEnabled(!drawing)
    handle.fibonacciRanges.setSelectionEnabled(!drawing)
    handle.fibonacciExtensions.setSelectionEnabled(!drawing)
    handle.warningCircles.setSelectionEnabled(!drawing)
    handle.icons.setSelectionEnabled(!drawing)
    handle.polylines.setSelectionEnabled(!drawing)
    handle.textAnchors.setSelectionEnabled(!drawing)
  }, [drawTool, epoch])

  useEffect(() => {
    syncDrawOverlay()
  }, [drawTool, measureActive])

  useEffect(() => {
    if (!selectedIdRef.current) return
    const exists =
      trendlines.some((d) => d.id === selectedIdRef.current) ||
      rectangles.some((d) => d.id === selectedIdRef.current) ||
      fibonacciRanges.some((d) => d.id === selectedIdRef.current) ||
      fibonacciExtensions.some((d) => d.id === selectedIdRef.current) ||
      warningCircles.some((d) => d.id === selectedIdRef.current) ||
      icons.some((d) => d.id === selectedIdRef.current) ||
      polylines.some((d) => d.id === selectedIdRef.current) ||
      textAnchors.some((d) => d.id === selectedIdRef.current)
    if (!exists) selectDrawing(null)
  }, [trendlines, rectangles, fibonacciRanges, fibonacciExtensions, warningCircles, icons, polylines, textAnchors, epoch])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key === 'Escape') {
        if (!drawToolRef.current) return
        event.preventDefault()
        cancelDrawTool()
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const id = selectedIdRef.current
      if (!id || drawToolRef.current) return
      event.preventDefault()
      onDeleteRef.current?.(id)
      selectDrawing(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle || candles.length === 0) return

    // Chart remount (chartType/timeframe) bumps epoch — clear applied OHLC so we full-sync.
    if (appliedEpochRef.current !== epoch) {
      appliedEpochRef.current = epoch
      appliedCandlesRef.current = []
    }

    const diff = diffCandles(appliedCandlesRef.current, candles)

    const tf = timeframe as CandleTimeframe
    const coordBars = chartCoordinateBars(candles, tf)
    candlesRef.current = coordBars
    syncDrawingBars(handle, coordBars)

    applyIndicatorVisibility(handle, showBollinger, showIchimoku)
    const prevToggles = indicatorToggleRef.current
    const bollingerToggled = prevToggles.showBollinger !== showBollinger
    const ichimokuToggled = prevToggles.showIchimoku !== showIchimoku
    const indicatorsChanged = bollingerToggled || ichimokuToggled

    if (diff.kind === 'unchanged' && indicatorsChanged) {
      const scale = handle.chart.timeScale()
      const logical = scale.getVisibleLogicalRange()
      const timeOpts = {
        barSpacing: scale.options().barSpacing,
        rightOffset: scale.options().rightOffset,
      }
      if (bollingerToggled && showBollinger) {
        syncBollingerBandData(handle, candles, true)
      }
      if (ichimokuToggled) {
        syncIchimokuSeries(handle, candles, tf, showIchimoku)
      }
      scale.applyOptions(timeOpts)
      if (logical) scale.setVisibleLogicalRange(logical)
      indicatorToggleRef.current = { showBollinger, showIchimoku }
      return
    }

    if (diff.kind === 'unchanged') return

    if (indicatorsChanged) {
      indicatorToggleRef.current = { showBollinger, showIchimoku }
    }

    const bands = showBollinger
      ? bollinger(candles)
      : {
          upper: [] as { time: Time; value: number }[],
          middle: [] as { time: Time; value: number }[],
          lower: [] as { time: Time; value: number }[],
          levels: emptyBandLevels(candles.length),
        }

    // Hot path: poll updates last bar only. historicalUpdate skips trailing whitespace.
    if (diff.kind === 'lastUpdated' && !indicatorsChanged) {
      const lastIndex = candles.length - 1
      const bar = candles[lastIndex]
      const level = bands.levels[lastIndex]
      handle.price.update(pricePoint(bar, level, chartType), true)
      if (showBollinger && level) {
        const time = bar.time as Time
        handle.upper.update({ time, value: level.upper }, true)
        handle.middle.update({ time, value: level.middle }, true)
        handle.lower.update({ time, value: level.lower }, true)
      }
      appliedCandlesRef.current = candles
      handle.firstTime = coordBars[0]?.time ?? null
      return
    }

    // Appended bars sit before EOD whitespace → full setData. Same for prepend/replace.
    const futureTimes = futureBarTimesUntilChartZoneEod(candles, tf)
    const scale = handle.chart.timeScale()
    const keep = handle.fitted ? scale.getVisibleLogicalRange() : null
    const previousFirst = handle.firstTime
    const prepended =
      diff.kind === 'prepended'
        ? diff.count
        : previousFirst == null
          ? 0
          : coordBars.filter((bar) => bar.time < previousFirst).length

    handle.price.setData([
      ...candles.map((bar, index) => pricePoint(bar, bands.levels[index], chartType)),
      ...futureTimes.map((t) => ({ time: t as Time })),
    ])
    syncBollingerBandData(handle, candles, showBollinger)
    syncIchimokuSeries(handle, candles, tf, showIchimoku)
    appliedCandlesRef.current = candles
    handle.firstTime = coordBars[0].time

    const snapshot = viewportSnapshotRef.current
    if (snapshot && snapshot.timeframe === timeframe && snapshot.range) {
      viewportSnapshotRef.current = null
      restoringViewportRef.current = true
      scale.applyOptions({
        barSpacing: snapshot.barSpacing,
        rightOffset: snapshot.rightOffset,
      })
      scale.setVisibleLogicalRange(snapshot.range)
      handle.fitted = true
      requestAnimationFrame(() => {
        if (handleRef.current !== handle) {
          restoringViewportRef.current = false
          return
        }
        scale.applyOptions({
          barSpacing: snapshot.barSpacing,
          rightOffset: snapshot.rightOffset,
        })
        scale.setVisibleLogicalRange(snapshot.range)
        restoringViewportRef.current = false
      })
    } else if (keep) {
      viewportSnapshotRef.current = null
      if (prepended !== 0) {
        scale.setVisibleLogicalRange({ from: keep.from + prepended, to: keep.to + prepended })
      }
    } else {
      viewportSnapshotRef.current = null
      const persisted = readViewport(timeframe)
      const fitDefault = () => {
        const to = candles.length + futureTimes.length
        const range = { from: Math.max(0, to - VIEWPORT.visibleBars), to }
        scale.setVisibleLogicalRange(range)
        handle.fitted = true
        requestAnimationFrame(() => {
          if (handleRef.current !== handle) return
          scale.setVisibleLogicalRange(range)
        })
      }
      if (persisted) {
        restoringViewportRef.current = true
        applyPersistedViewport(scale, persisted)
        if (scale.getVisibleRange()) {
          handle.fitted = true
          requestAnimationFrame(() => {
            if (handleRef.current !== handle) {
              restoringViewportRef.current = false
              return
            }
            applyPersistedViewport(scale, persisted)
            restoringViewportRef.current = false
          })
        } else {
          restoringViewportRef.current = false
          fitDefault()
        }
      } else {
        fitDefault()
      }
    }
  }, [candles, timeframe, chartType, epoch, showBollinger, showIchimoku])

  useEffect(() => {
    if (resetLayoutEpoch <= appliedResetLayoutEpochRef.current) return
    const handle = handleRef.current
    if (!handle || candles.length === 0) return
    appliedResetLayoutEpochRef.current = resetLayoutEpoch
    const layout = defaultChartLayout(candles.length)
    handle.price.priceScale().applyOptions({
      autoScale: true,
      scaleMargins: layout.scaleMargins,
    })
    handle.chart.timeScale().setVisibleLogicalRange(layout.logicalRange)
    handle.fitted = true
    onResetLayoutApplied?.(resetLayoutEpoch)
    requestAnimationFrame(() => {
      if (handleRef.current !== handle) return
      handle.price.priceScale().applyOptions({
        autoScale: true,
        scaleMargins: layout.scaleMargins,
      })
      handle.chart.timeScale().setVisibleLogicalRange(layout.logicalRange)
    })
  }, [candles.length, epoch, onResetLayoutApplied, resetLayoutEpoch])

  return (
    <div
      className="relative h-full min-h-0 w-full"
      style={drawTool || measureActive ? { overscrollBehavior: 'none' } : undefined}
    >
      <div ref={ref} className="h-full min-h-0 w-full" />
      <div
        ref={drawOverlayRef}
        className={`absolute inset-0 z-10 touch-none${drawTool || measureActive ? ' cursor-crosshair' : ''}`}
        style={{
          pointerEvents: drawTool || measureActive ? 'auto' : 'none',
          ...(drawTool || measureActive ? { overscrollBehavior: 'none' as const, touchAction: 'none' as const } : null),
        }}
        aria-hidden={!drawTool && !measureActive}
      />
      {(drawTool || measureActive) && pointerCoarse ? (
        <Button
          type="button"
          variant="secondary"
          size="icon-lg"
          className="absolute right-3 bottom-3 z-20 size-11 shadow-md"
          aria-label="Cancel drawing"
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            if (measureActive) cancelMeasurementRef.current?.()
            else cancelDrawTool()
          }}
        >
          <X />
        </Button>
      ) : null}
    </div>
  )
}
