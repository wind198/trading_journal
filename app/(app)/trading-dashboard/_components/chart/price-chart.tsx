'use client'

import { useEffect, useRef, useState } from 'react'
import type { IChartApi, Time } from 'lightweight-charts'
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
import { bollinger, pricePoint, type ChartType } from '../../_lib/chart/price-chart-series'
import type { EngulfingOverlayEvent } from './_components/indicators/engulfing/engulfing-overlay-primitive'
import type { ForceOverlayEvent } from './_components/indicators/force/force-overlay-primitive'
import type { VolumeProfileFrame } from '../../_lib/chart/volume-profile'
import type { IconMarkerDrawing } from './_components/objects/icon/icon-marker-primitive'
import type { RectangleDrawing } from './_components/objects/rect/rectangle-primitive'
import type { FibonacciRangeExtensionDrawing } from './_components/objects/fibonacci-extension/fibonacci-range-extension-primitive'
import type { FibonacciRangeDrawing } from './_components/objects/fibonacci-range/fibonacci-range-primitive'
import type { PolylineArrowDrawing } from './_components/objects/polyline/polyline-arrow-primitive'
import type { TextAnchorDrawing } from './_components/objects/text/text-anchor-primitive'
import type { TrendlineDrawing } from './_components/objects/trendline/trendline-primitive'
import type { WarningCircleDrawing } from './_components/objects/warning-circle/warning-circle-primitive'
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

export function PriceChart({
  candles,
  chartType,
  timeframe,
  onLoadOlder,
  axesVisible,
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
  volumeProfile = null,
  drawTool = null,
  onDrawingComplete,
  onDrawingChange,
  onDrawingChangeEnd,
  onDrawingDelete,
  onSelectionChange,
  onDrawToolCancel,
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
  volumeProfile?: VolumeProfileFrame | null
  drawTool?: DrawTool
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
  onPolylineComplete?: (input: { points: DrawingPoint[] }) => void
  onPolylineChange?: (id: string, points: DrawingPoint[]) => void
  onPolylineChangeEnd?: (id: string) => void
  onPolylineLabelEdit?: (id: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drawOverlayRef = useRef<HTMLDivElement>(null)
  const pointerCaptureElRef = useRef<HTMLElement | null>(null)
  const handleRef = useRef<ChartHandle | null>(null)
  const [pointerCoarse, setPointerCoarse] = useState(false)
  const candlesRef = useRef<BarTimeSeries>(candles ?? [])
  const appliedCandlesRef = useRef<LightweightCandle[]>([])
  const appliedEpochRef = useRef(-1)
  const onLoadOlderRef = useRef(onLoadOlder)
  const axesVisibleRef = useRef(axesVisible)
  const drawToolRef = useRef(drawTool)
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
  const onPolylineCompleteRef = useRef(onPolylineComplete)
  const onPolylineChangeRef = useRef(onPolylineChange)
  const onPolylineChangeEndRef = useRef(onPolylineChangeEnd)
  const onPolylineLabelEditRef = useRef(onPolylineLabelEdit)
  const [epoch, setEpoch] = useState(0)
  trendlinesRef.current = trendlines
  rectanglesRef.current = rectangles
  fibonacciRangesRef.current = fibonacciRanges
  warningCirclesRef.current = warningCircles
  iconsRef.current = icons
  polylinesRef.current = polylines
  textAnchorsRef.current = textAnchors
  onLoadOlderRef.current = onLoadOlder
  axesVisibleRef.current = axesVisible
  drawToolRef.current = drawTool
  onCompleteRef.current = onDrawingComplete
  onChangeRef.current = onDrawingChange
  onChangeEndRef.current = onDrawingChangeEnd
  onDeleteRef.current = onDrawingDelete
  onSelectionChangeRef.current = onSelectionChange
  onDrawToolCancelRef.current = onDrawToolCancel
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
    const drawing = drawToolRef.current != null
    overlay.style.pointerEvents = drawing ? 'auto' : 'none'
  }

  const syncInteractionLock = () => {
    const handle = handleRef.current
    if (!handle) return
    const drawing = drawToolRef.current != null
    const dragging = editSessionRef.current?.isDragging ?? false
    const locked = drawing || dragging
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
          iconsRef,
          textAnchorsRef,
          warningCirclesRef,
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

      setEpoch((value) => value + 1)
    })

    return () => {
      cancelled = true
      removePointerHandlers?.()
      const handle = handleRef.current
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
    handle.indicators.setVolumeProfile(volumeProfile)
  }, [volumeProfile, epoch])

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
  }, [drawTool, epoch])

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
  }, [drawTool])

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

    if (diff.kind === 'unchanged') return

    const bands = bollinger(candles)

    // Hot path: poll updates last bar only. historicalUpdate skips trailing whitespace.
    if (diff.kind === 'lastUpdated') {
      const lastIndex = candles.length - 1
      const bar = candles[lastIndex]
      const level = bands.levels[lastIndex]
      handle.price.update(pricePoint(bar, level, chartType), true)
      if (level) {
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
    handle.upper.setData(bands.upper)
    handle.middle.setData(bands.middle)
    handle.lower.setData(bands.lower)
    appliedCandlesRef.current = candles
    handle.firstTime = coordBars[0].time

    if (keep) {
      if (prepended !== 0) {
        scale.setVisibleLogicalRange({ from: keep.from + prepended, to: keep.to + prepended })
      }
    } else {
      const to = candles.length + futureTimes.length
      const range = { from: Math.max(0, to - VIEWPORT.visibleBars), to }
      scale.setVisibleLogicalRange(range)
      handle.fitted = true
      requestAnimationFrame(() => {
        if (handleRef.current !== handle) return
        scale.setVisibleLogicalRange(range)
      })
    }
  }, [candles, timeframe, chartType, epoch])

  return (
    <div
      className="relative h-full min-h-0 w-full"
      style={drawTool ? { overscrollBehavior: 'none' } : undefined}
    >
      <div ref={ref} className="h-full min-h-0 w-full" />
      <div
        ref={drawOverlayRef}
        className={`absolute inset-0 z-10 touch-none${drawTool ? ' cursor-crosshair' : ''}`}
        style={{
          pointerEvents: drawTool ? 'auto' : 'none',
          ...(drawTool ? { overscrollBehavior: 'none' as const, touchAction: 'none' as const } : null),
        }}
        aria-hidden={!drawTool}
      />
      {drawTool && pointerCoarse ? (
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
            cancelDrawTool()
          }}
        >
          <X />
        </Button>
      ) : null}
    </div>
  )
}
