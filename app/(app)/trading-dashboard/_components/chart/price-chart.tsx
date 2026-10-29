'use client'

import { useEffect, useRef, useState } from 'react'
import type { IChartApi, Time } from 'lightweight-charts'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CandleTimeframe, LightweightCandle } from '@/lib/ticks/candles'
import type { ChartDrawingKind, DrawingPoint } from '../../_lib/chart/chart-drawings'
import { isChartIconKind } from '../../_lib/chart/chart-icons'
import type { BarTimeSeries } from '../../_lib/chart/chart-coordinates'
import {
  chartCoordinateBars,
  futureBarTimesUntilChartZoneEod,
} from '../../_lib/chart/extend-candles-to-chart-eod'
import { VIEWPORT } from '../../_lib/chart/price-chart-style'
import { bollinger, pricePoint, type ChartType } from '../../_lib/chart/price-chart-series'
import type { EngulfingOverlayEvent } from './primitives/engulfing-overlay-primitive'
import type { ForceOverlayEvent } from './primitives/force-overlay-primitive'
import type { VolumeProfileFrame } from '../../_lib/chart/volume-profile'
import type { IconMarkerDrawing } from './primitives/icon-marker-primitive'
import type { RectangleDrawing } from './primitives/rectangle-primitive'
import type { PolylineArrowDrawing } from './primitives/polyline-arrow-primitive'
import type { TrendlineDrawing } from './primitives/trendline-primitive'
import {
  bindPriceChartInteraction,
  isShapeDrawTool,
  type DrawingDragState,
  type PolylineDragState,
  type TouchShapePhase,
} from './bind-price-chart-interaction'
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
  icons = [],
  polylines = [],
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
  icons?: readonly IconMarkerDrawing[]
  polylines?: readonly PolylineArrowDrawing[]
  forceEvents?: readonly ForceOverlayEvent[]
  engulfingEvents?: readonly EngulfingOverlayEvent[]
  volumeProfile?: VolumeProfileFrame | null
  drawTool?: DrawTool
  onDrawingComplete?: (input: {
    kind: ChartDrawingKind
    p1: DrawingPoint
    p2: DrawingPoint
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
  const candlesRef = useRef<BarTimeSeries>(candles ?? [])
  const onLoadOlderRef = useRef(onLoadOlder)
  const axesVisibleRef = useRef(axesVisible)
  const drawToolRef = useRef(drawTool)
  const draftRef = useRef<DrawingPoint | null>(null)
  const dragRef = useRef<DrawingDragState | null>(null)
  const polylineDragRef = useRef<PolylineDragState | null>(null)
  const didDragRef = useRef(false)
  const skipNextClickRef = useRef(false)
  const tapStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const iconPressRef = useRef<{
    id: string
    x: number
    y: number
    pointerId: number
  } | null>(null)
  const touchShapePhaseRef = useRef<TouchShapePhase>('idle')
  const touchShapeDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const shapePreviewP2Ref = useRef<DrawingPoint | null>(null)
  const shapeP1GestureRef = useRef(false)
  const polylineDraftRef = useRef<DrawingPoint[]>([])
  const lastPolyTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  const lastLabelTapRef = useRef<{ id: string; time: number; x: number; y: number } | null>(
    null,
  )
  const pointerCoarseRef = useRef(false)
  const chartElRef = useRef<HTMLElement | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const trendlinesRef = useRef(trendlines)
  const rectanglesRef = useRef(rectangles)
  const iconsRef = useRef(icons)
  const polylinesRef = useRef(polylines)
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
  const [shapeAwaitingP2, setShapeAwaitingP2] = useState(false)
  const [showCoarseUi, setShowCoarseUi] = useState(false)
  const setShapeAwaitingP2Ref = useRef(setShapeAwaitingP2)
  setShapeAwaitingP2Ref.current = setShapeAwaitingP2
  trendlinesRef.current = trendlines
  rectanglesRef.current = rectangles
  iconsRef.current = icons
  polylinesRef.current = polylines
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
    const dragging = dragRef.current != null || polylineDragRef.current != null
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
      setShowCoarseUi(mq.matches)
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
    handle?.icons.setSelectedId(id)
    handle?.polylines.setSelectedId(id)
    if (changed) onSelectionChangeRef.current?.(id)
  }

  const clearDrafts = () => {
    draftRef.current = null
    polylineDraftRef.current = []
    lastPolyTapRef.current = null
    lastLabelTapRef.current = null
    touchShapePhaseRef.current = 'idle'
    touchShapeDragStartRef.current = null
    shapePreviewP2Ref.current = null
    shapeP1GestureRef.current = false
    setShapeAwaitingP2Ref.current(false)
    const handle = handleRef.current
    handle?.trendlines.setDraft(null)
    handle?.rectangles.setDraft(null)
    handle?.icons.setDraft(null)
    handle?.polylines.setDraft(null)
  }

  const setActiveDraft = (draft: { p1: DrawingPoint; p2?: DrawingPoint } | null) => {
    const tool = drawToolRef.current
    const handle = handleRef.current
    if (!handle || !tool || isChartIconKind(tool)) return
    if (tool === 'trendline') {
      handle.trendlines.setDraft(draft)
      handle.rectangles.setDraft(null)
      handle.icons.setDraft(null)
    } else if (tool === 'rectangle') {
      handle.rectangles.setDraft(draft)
      handle.trendlines.setDraft(null)
      handle.icons.setDraft(null)
    }
  }

  const setShapeDraft = (p1: DrawingPoint, p2?: DrawingPoint) => {
    const preview = p2 ?? shapePreviewP2Ref.current ?? p1
    shapePreviewP2Ref.current = preview
    setActiveDraft({ p1, p2: preview })
  }
  const setShapeDraftRef = useRef(setShapeDraft)
  setShapeDraftRef.current = setShapeDraft

  const commitShapeDraft = () => {
    const tool = drawToolRef.current
    if (!tool || !isShapeDrawTool(tool)) return
    const p1 = draftRef.current
    const p2 = shapePreviewP2Ref.current
    if (!p1 || !p2) return
    clearDrafts()
    onCompleteRef.current?.({ kind: tool, p1, p2 })
  }

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
          draftRef,
          dragRef,
          polylineDragRef,
          didDragRef,
          skipNextClickRef,
          tapStartRef,
          iconPressRef,
          touchShapePhaseRef,
          touchShapeDragStartRef,
          shapePreviewP2Ref,
          shapeP1GestureRef,
          polylineDraftRef,
          lastPolyTapRef,
          lastLabelTapRef,
          pointerCoarseRef,
          pointerCaptureElRef,
          chartElRef,
          selectedIdRef,
          candlesRef,
          trendlinesRef,
          rectanglesRef,
          iconsRef,
          setShapeAwaitingP2Ref,
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
        handle.chart.remove()
        return
      }

      setEpoch((value) => value + 1)
    })

    return () => {
      cancelled = true
      removePointerHandlers?.()
      handleRef.current = null
      draftRef.current = null
      touchShapePhaseRef.current = 'idle'
      touchShapeDragStartRef.current = null
      dragRef.current = null
      polylineDragRef.current = null
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
    handle.forceOverlay.setEvents(forceEvents)
  }, [forceEvents, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.engulfingOverlay.setEvents(engulfingEvents)
  }, [engulfingEvents, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    handle.volumeProfile?.setProfile(volumeProfile)
  }, [volumeProfile, epoch])

  useEffect(() => {
    clearDrafts()
    if (drawTool) selectDrawing(null)
  }, [drawTool, epoch])

  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    syncInteractionLock()
    const drawing = drawTool != null
    handle.trendlines.setSelectionEnabled(!drawing)
    handle.rectangles.setSelectionEnabled(!drawing)
    handle.icons.setSelectionEnabled(!drawing)
    handle.polylines.setSelectionEnabled(!drawing)
  }, [drawTool, epoch])

  useEffect(() => {
    syncDrawOverlay()
  }, [drawTool])

  useEffect(() => {
    if (!selectedIdRef.current) return
    const exists =
      trendlines.some((d) => d.id === selectedIdRef.current) ||
      rectangles.some((d) => d.id === selectedIdRef.current) ||
      icons.some((d) => d.id === selectedIdRef.current) ||
      polylines.some((d) => d.id === selectedIdRef.current)
    if (!exists) selectDrawing(null)
  }, [trendlines, rectangles, icons, polylines, epoch])

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
        clearDrafts()
        onDrawToolCancelRef.current?.()
        syncInteractionLock()
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

    const tf = timeframe as CandleTimeframe
    const futureTimes = futureBarTimesUntilChartZoneEod(candles, tf)
    const coordBars = chartCoordinateBars(candles, tf)
    candlesRef.current = coordBars

    const scale = handle.chart.timeScale()
    const keep = handle.fitted ? scale.getVisibleLogicalRange() : null
    const previousFirst = handle.firstTime
    const prepended =
      previousFirst == null ? 0 : coordBars.filter((bar) => bar.time < previousFirst).length

    const bands = bollinger(candles)
    handle.price.setData([
      ...candles.map((bar, index) => pricePoint(bar, bands.levels[index], chartType)),
      ...futureTimes.map((t) => ({ time: t as Time })),
    ])
    handle.upper.setData(bands.upper)
    handle.middle.setData(bands.middle)
    handle.lower.setData(bands.lower)
    handle.forceOverlay.setEvents(forceEvents)
    handle.engulfingOverlay.setEvents(engulfingEvents)
    handle.volumeProfile?.setProfile(volumeProfile)
    syncDrawingBars(handle, coordBars)
    handle.sessionVerticalLines?.setBars(coordBars)
    handle.firstTime = coordBars[0].time
    if (keep) {
      scale.setVisibleLogicalRange({ from: keep.from + prepended, to: keep.to + prepended })
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
  }, [candles, timeframe, chartType, epoch, forceEvents, engulfingEvents, volumeProfile])

  return (
    <div className="relative h-full min-h-0 w-full">
      <div ref={ref} className="h-full min-h-0 w-full" />
      <div
        ref={drawOverlayRef}
        className={`absolute inset-0 z-10 touch-none${drawTool ? ' cursor-crosshair' : ''}`}
        style={{ pointerEvents: drawTool ? 'auto' : 'none' }}
        aria-hidden={!drawTool}
      />
      {showCoarseUi &&
        shapeAwaitingP2 &&
        drawTool != null &&
        isShapeDrawTool(drawTool) && (
          <Button
            type="button"
            size="icon"
            className="absolute bottom-3 right-3 z-20 size-11 touch-manipulation shadow-md"
            aria-label="Confirm second point"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              commitShapeDraft()
            }}
          >
            <Check className="size-5" />
          </Button>
        )}
    </div>
  )
}
