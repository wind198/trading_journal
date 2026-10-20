'use client'

import { useEffect, useRef, useState } from 'react'
import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { LightweightCandle } from '@/lib/ticks/candles'
import {
  isPolylineArrowKind,
  type ChartDrawingKind,
  type DrawingPoint,
} from '../../_lib/chart/chart-drawings'
import { isChartIconKind } from '../../_lib/chart/chart-icons'
import { timeAtChartX } from '../../_lib/chart/chart-coordinates'
import {
  formatChartCrosshairTime,
  formatChartTickMark,
} from '../../_lib/chart/chart-timezone'
import {
  BOLLINGER,
  CANDLE,
  CHART_THEME,
  PRICE_FORMAT,
  VIEWPORT,
} from '../../_lib/chart/price-chart-style'
import { bollinger, pricePoint, type ChartType } from '../../_lib/chart/price-chart-series'
import {
  EngulfingOverlayPrimitive,
  type EngulfingOverlayEvent,
} from './primitives/engulfing-overlay-primitive'
import {
  ForceOverlayPrimitive,
  type ForceOverlayEvent,
} from './primitives/force-overlay-primitive'
import { IconMarkerPrimitive, type IconMarkerDrawing } from './primitives/icon-marker-primitive'
import { RectanglePrimitive, type RectangleDrawing } from './primitives/rectangle-primitive'
import {
  PolylineArrowPrimitive,
  type PolylineArrowDrawing,
} from './primitives/polyline-arrow-primitive'
import { TrendlinePrimitive, type TrendlineDrawing } from './primitives/trendline-primitive'

export type { ChartType }
export type DrawTool = ChartDrawingKind | null

type AnyPrimitive =
  | TrendlinePrimitive
  | RectanglePrimitive
  | IconMarkerPrimitive
  | PolylineArrowPrimitive
  | ForceOverlayPrimitive
  | EngulfingOverlayPrimitive

type PriceSeries = {
  setData: (data: readonly object[]) => void
  attachPrimitive: (primitive: AnyPrimitive) => void
}

type LineSeries = {
  setData: (data: { time: Time; value: number }[]) => void
}

type LogicalRange = { from: number; to: number }

const TAP_MOVE_THRESHOLD_PX = 12
const TOUCH_HIT_BOOST = 1.75
const MIN_SHAPE_COMMIT_PX = 4
const DOUBLE_TAP_MS = 350
const DOUBLE_TAP_PX = 24

type ShapeDrawTool = 'trendline' | 'rectangle'
type TouchShapePhase = 'idle' | 'has_p1' | 'dragging_p2'

function isShapeDrawTool(tool: ChartDrawingKind | null): tool is ShapeDrawTool {
  return tool === 'trendline' || tool === 'rectangle'
}

type ChartHandle = {
  chart: IChartApi
  price: PriceSeries & ISeriesApi<SeriesType, Time>
  upper: LineSeries
  middle: LineSeries
  lower: LineSeries
  trendlines: TrendlinePrimitive
  rectangles: RectanglePrimitive
  icons: IconMarkerPrimitive
  polylines: PolylineArrowPrimitive
  forceOverlay: ForceOverlayPrimitive
  engulfingOverlay: EngulfingOverlayPrimitive
  fitted: boolean
  firstTime: number | null
}

function syncDrawingBars(handle: ChartHandle, candles: readonly LightweightCandle[]) {
  handle.trendlines.setBars(candles)
  handle.rectangles.setBars(candles)
  handle.icons.setBars(candles)
  handle.polylines.setBars(candles)
}

/** Resolve click → time/price at cursor (no series or bar-center snap). */
function clickToPoint(
  handle: ChartHandle,
  point: { x: number; y: number },
  candles: readonly LightweightCandle[] | null | undefined,
): DrawingPoint | null {
  try {
    const bars = candles ?? []
    const timeSec = timeAtChartX(handle.chart, point.x, bars)
    if (timeSec == null) return null
    const priceRaw = handle.price.coordinateToPrice(point.y)
    if (priceRaw == null) return null
    return { time: timeSec, price: Number(priceRaw) }
  } catch {
    return null
  }
}

export function PriceChart({
  candles,
  chartType,
  onLoadOlder,
  axesVisible,
  trendlines = [],
  rectangles = [],
  icons = [],
  polylines = [],
  forceEvents = [],
  engulfingEvents = [],
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
  onLoadOlder?: () => void
  axesVisible: boolean
  trendlines?: readonly TrendlineDrawing[]
  rectangles?: readonly RectangleDrawing[]
  icons?: readonly IconMarkerDrawing[]
  polylines?: readonly PolylineArrowDrawing[]
  forceEvents?: readonly ForceOverlayEvent[]
  engulfingEvents?: readonly EngulfingOverlayEvent[]
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
  const candlesRef = useRef<readonly LightweightCandle[]>(candles ?? [])
  const onLoadOlderRef = useRef(onLoadOlder)
  const axesVisibleRef = useRef(axesVisible)
  const drawToolRef = useRef(drawTool)
  const draftRef = useRef<DrawingPoint | null>(null)
  const dragRef = useRef<{
    id: string
    endpoint: 'p1' | 'p2'
    p1: DrawingPoint
    p2: DrawingPoint
    moveWhole: boolean
  } | null>(null)
  const polylineDragRef = useRef<{
    id: string
    vertexIndex: number
    points: DrawingPoint[]
  } | null>(null)
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
  candlesRef.current = candles ?? []
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

  const syncDrawingHitGeometry = () => {
    const handle = handleRef.current
    if (!handle) return
    handle.trendlines.updateAllViews()
    handle.rectangles.updateAllViews()
    handle.icons.updateAllViews()
    handle.polylines.updateAllViews()
  }

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
    }
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const drawingPoints = (id: string): { p1: DrawingPoint; p2: DrawingPoint } | null => {
    const fromTrend = trendlinesRef.current.find((d) => d.id === id)
    if (fromTrend) return { p1: fromTrend.p1, p2: fromTrend.p2 }
    const fromRect = rectanglesRef.current.find((d) => d.id === id)
    if (fromRect) return { p1: fromRect.p1, p2: fromRect.p2 }
    const fromIcon = iconsRef.current.find((d) => d.id === id)
    if (fromIcon) return { p1: fromIcon.p1, p2: fromIcon.p1 }
    const handle = handleRef.current
    if (!handle) return null
    const line = handle.trendlines.getDrawing(id)
    if (line) return { p1: line.p1, p2: line.p2 }
    const rect = handle.rectangles.getDrawing(id)
    if (rect) return { p1: rect.p1, p2: rect.p2 }
    const icon = handle.icons.getDrawing(id)
    if (icon) return { p1: icon.p1, p2: icon.p1 }
    return null
  }

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
    } else {
      handle.rectangles.setDraft(draft)
      handle.trendlines.setDraft(null)
      handle.icons.setDraft(null)
    }
  }

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let cancelled = false
    let createdChart: IChartApi | null = null
    let removePointerHandlers: (() => void) | null = null

    void import('lightweight-charts').then((lwc) => {
      if (cancelled || !ref.current) return

      const created = lwc.createChart(ref.current, {
        autoSize: true,
        layout: {
          background: { type: lwc.ColorType.Solid, color: 'transparent' },
          textColor: CHART_THEME.text,
        },
        grid: {
          vertLines: { color: CHART_THEME.grid },
          horzLines: { color: CHART_THEME.grid },
        },
        localization: {
          timeFormatter: (time: Time) => formatChartCrosshairTime(time),
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          visible: axesVisibleRef.current,
          tickMarkFormatter: (time: Time, tickMarkType: number) =>
            formatChartTickMark(time, tickMarkType),
        },
        rightPriceScale: { borderVisible: false, visible: axesVisibleRef.current },
      })
      createdChart = created

      const price =
        chartType === 'candlestick'
          ? created.addSeries(lwc.CandlestickSeries, {
              priceFormat: PRICE_FORMAT,
              upColor: CANDLE.up,
              downColor: CANDLE.down,
              borderUpColor: CANDLE.borderUp,
              borderDownColor: CANDLE.borderDown,
              wickUpColor: CANDLE.wickUp,
              wickDownColor: CANDLE.wickDown,
            })
          : chartType === 'bar'
            ? created.addSeries(lwc.BarSeries, {
                priceFormat: PRICE_FORMAT,
                upColor: CANDLE.up,
                downColor: CANDLE.down,
              })
            : chartType === 'area'
              ? created.addSeries(lwc.AreaSeries, {
                  priceFormat: PRICE_FORMAT,
                  lineColor: CHART_THEME.priceLine,
                  topColor: CHART_THEME.areaTop,
                  bottomColor: CHART_THEME.areaBottom,
                })
              : created.addSeries(lwc.LineSeries, {
                  priceFormat: PRICE_FORMAT,
                  color: CHART_THEME.priceLine,
                  lineWidth: 2,
                })

      const line = (color: string) =>
        created.addSeries(lwc.LineSeries, {
          color,
          lineWidth: 1,
          priceFormat: PRICE_FORMAT,
          priceLineVisible: false,
          lastValueVisible: false,
        })

      if (cancelled) {
        created.remove()
        return
      }

      const trendlinePrimitive = new TrendlinePrimitive([])
      const rectanglePrimitive = new RectanglePrimitive([])
      const iconMarkerPrimitive = new IconMarkerPrimitive([])
      const polylineArrowPrimitive = new PolylineArrowPrimitive([])
      const forceOverlayPrimitive = new ForceOverlayPrimitive([])
      const engulfingOverlayPrimitive = new EngulfingOverlayPrimitive([])
      price.attachPrimitive(trendlinePrimitive)
      price.attachPrimitive(rectanglePrimitive)
      price.attachPrimitive(iconMarkerPrimitive)
      price.attachPrimitive(polylineArrowPrimitive)
      price.attachPrimitive(forceOverlayPrimitive)
      price.attachPrimitive(engulfingOverlayPrimitive)

      let adjusting = false
      created.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (!range || adjusting) return
        if (range.to - range.from > VIEWPORT.maxVisibleBars) {
          adjusting = true
          created.timeScale().setVisibleLogicalRange({
            from: range.to - VIEWPORT.maxVisibleBars,
            to: range.to,
          })
          adjusting = false
          return
        }
        if (range.from < VIEWPORT.loadEdge) onLoadOlderRef.current?.()
      })

      const handle: ChartHandle = {
        chart: created,
        price: price as unknown as PriceSeries & ISeriesApi<SeriesType, Time>,
        upper: line(BOLLINGER.bandUpper) as LineSeries,
        middle: line(BOLLINGER.bandMiddle) as LineSeries,
        lower: line(BOLLINGER.bandLower) as LineSeries,
        trendlines: trendlinePrimitive,
        rectangles: rectanglePrimitive,
        icons: iconMarkerPrimitive,
        polylines: polylineArrowPrimitive,
        forceOverlay: forceOverlayPrimitive,
        engulfingOverlay: engulfingOverlayPrimitive,
        fitted: false,
        firstTime: null,
      }
      handleRef.current = handle
      syncDrawingBars(handle, candlesRef.current)

      const pointFromEvent = (param: { point?: { x: number; y: number } }) => {
        if (!param.point) return null
        return clickToPoint(handle, param.point, candlesRef.current)
      }

      const applyPointerHitBoost = (event: PointerEvent) => {
        const boost =
          event.pointerType === 'touch' || pointerCoarseRef.current ? TOUCH_HIT_BOOST : 1
        handle.trendlines.setHitBoost(boost)
        handle.rectangles.setHitBoost(boost)
        handle.icons.setHitBoost(boost)
        handle.polylines.setHitBoost(boost)
      }

      const isCoarsePointer = (event: PointerEvent) =>
        event.pointerType === 'touch' || pointerCoarseRef.current

      const isDoubleTapAt = (clientX: number, clientY: number) => {
        const prev = lastPolyTapRef.current
        if (!prev) return false
        const dt = Date.now() - prev.time
        const dist = Math.hypot(clientX - prev.x, clientY - prev.y)
        return dt <= DOUBLE_TAP_MS && dist <= DOUBLE_TAP_PX
      }

      const tryOpenLabelEditor = (
        clientX: number,
        clientY: number,
        polylineId: string,
      ) => {
        const prev = lastLabelTapRef.current
        const now = Date.now()
        if (
          prev &&
          prev.id === polylineId &&
          now - prev.time <= DOUBLE_TAP_MS &&
          Math.hypot(clientX - prev.x, clientY - prev.y) <= DOUBLE_TAP_PX
        ) {
          lastLabelTapRef.current = null
          onPolylineLabelEditRef.current?.(polylineId)
          return true
        }
        lastLabelTapRef.current = { id: polylineId, time: now, x: clientX, y: clientY }
        return false
      }

      const handlePolylinePlacement = (
        point: { x: number; y: number },
        clientX: number,
        clientY: number,
      ) => {
        const mapped = clickToPoint(handle, point, candlesRef.current)
        if (!mapped) return

        if (isDoubleTapAt(clientX, clientY)) {
          lastPolyTapRef.current = null
          const points = [...polylineDraftRef.current, mapped]
          if (points.length >= 2) {
            onPolylineCompleteRef.current?.({ points })
            clearDrafts()
          }
          return
        }

        polylineDraftRef.current = [...polylineDraftRef.current, mapped]
        setPolylineDraft(polylineDraftRef.current)
        lastPolyTapRef.current = { time: Date.now(), x: clientX, y: clientY }
      }

      const handleChartTap = (
        point: { x: number; y: number },
        clientX?: number,
        clientY?: number,
      ) => {
        syncDrawingHitGeometry()
        const tool = drawToolRef.current
        if (tool) {
          if (isShapeDrawTool(tool) && pointerCoarseRef.current) return
          const mapped = clickToPoint(handle, point, candlesRef.current)
          if (!mapped) return
          if (isChartIconKind(tool)) {
            clearDrafts()
            onCompleteRef.current?.({ kind: tool, p1: mapped, p2: mapped })
            return
          }
          if (isPolylineArrowKind(tool)) {
            if (clientX == null || clientY == null) return
            handlePolylinePlacement(point, clientX, clientY)
            return
          }
          const first = draftRef.current
          if (!first) {
            draftRef.current = mapped
            setActiveDraft({ p1: mapped })
            return
          }
          clearDrafts()
          onCompleteRef.current?.({ kind: tool, p1: first, p2: mapped })
          return
        }
        const lineHit = handle.trendlines.hitTest(point.x, point.y)
        const rectHit = handle.rectangles.hitTest(point.x, point.y)
        const iconHit = handle.icons.hitTest(point.x, point.y)
        const polyHit = handle.polylines.hitTest(point.x, point.y)
        const hit = [lineHit, rectHit, iconHit, polyHit]
          .filter((item): item is NonNullable<typeof item> => item != null)
          .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))[0]
        const hitId = hit?.externalId ?? null
        if (
          hitId &&
          polyHit?.externalId === hitId &&
          clientX != null &&
          clientY != null &&
          tryOpenLabelEditor(clientX, clientY, hitId)
        ) {
          selectDrawing(hitId)
          return
        }
        selectDrawing(hitId)
      }

      created.subscribeClick((param) => {
        if (!param.point) return
        if (drawToolRef.current) return
        if (skipNextClickRef.current) {
          skipNextClickRef.current = false
          return
        }
        if (didDragRef.current) {
          didDragRef.current = false
          return
        }
        handleChartTap(param.point, param.point.x, param.point.y)
      })

      const updateDraftPreview = (param: { point?: { x: number; y: number } }) => {
        const tool = drawToolRef.current
        if (tool && isPolylineArrowKind(tool)) return
        if (!tool) return
        const first = draftRef.current
        if (!first) return
        if (!param.point) {
          setActiveDraft({ p1: first })
          return
        }
        const hover = pointFromEvent(param)
        if (!hover) return
        setActiveDraft({ p1: first, p2: hover })
      }

      // Live preview: after p1, rubber-band to cursor/touch.
      created.subscribeCrosshairMove(updateDraftPreview)

      const chartEl = created.chartElement()
      chartElRef.current = chartEl
      chartEl.style.touchAction = 'manipulation'

      const localPoint = (event: PointerEvent) => {
        const rect = chartEl.getBoundingClientRect()
        return { x: event.clientX - rect.left, y: event.clientY - rect.top }
      }

      const drawOverlayEl = drawOverlayRef.current

      const setCapture = (event: PointerEvent, el: HTMLElement) => {
        el.setPointerCapture(event.pointerId)
        pointerCaptureElRef.current = el
      }

      const releaseCapture = (event: PointerEvent) => {
        const el = pointerCaptureElRef.current ?? chartEl
        pointerCaptureElRef.current = null
        try {
          el.releasePointerCapture(event.pointerId)
        } catch {
          /* lost capture */
        }
      }

      const onDrawOverlayPointerDown = (event: PointerEvent) => {
        if (!drawToolRef.current) return
        applyPointerHitBoost(event)
        tapStartRef.current = {
          x: event.clientX,
          y: event.clientY,
          pointerId: event.pointerId,
        }
        event.preventDefault()
        if (drawOverlayEl) setCapture(event, drawOverlayEl)
        syncInteractionLock()

        const tool = drawToolRef.current
        if (tool && isPolylineArrowKind(tool)) return
        if (isCoarsePointer(event) && tool && isShapeDrawTool(tool)) {
          const mapped = clickToPoint(handle, localPoint(event), candlesRef.current)
          if (!mapped) return

          if (touchShapePhaseRef.current === 'idle' || !draftRef.current) {
            draftRef.current = mapped
            touchShapePhaseRef.current = 'has_p1'
            setActiveDraft({ p1: mapped })
            skipNextClickRef.current = true
            return
          }
          if (touchShapePhaseRef.current === 'has_p1') {
            touchShapePhaseRef.current = 'dragging_p2'
            touchShapeDragStartRef.current = {
              x: event.clientX,
              y: event.clientY,
            }
            setActiveDraft({ p1: draftRef.current, p2: mapped })
            skipNextClickRef.current = true
          }
        }
      }

      const onDrawOverlayPointerMove = (event: PointerEvent) => {
        if (!drawToolRef.current) return
        const point = localPoint(event)
        const tool = drawToolRef.current

        if (tool && isPolylineArrowKind(tool)) {
          const pts = polylineDraftRef.current
          if (pts.length === 0) return
          const hover = clickToPoint(handle, point, candlesRef.current)
          if (!hover) return
          setPolylineDraft(pts, hover)
          return
        }

        if (
          tool &&
          isShapeDrawTool(tool) &&
          touchShapePhaseRef.current === 'dragging_p2' &&
          draftRef.current
        ) {
          const mapped = clickToPoint(handle, point, candlesRef.current)
          if (mapped) setActiveDraft({ p1: draftRef.current, p2: mapped })
          return
        }

        if (draftRef.current) updateDraftPreview({ point })
      }

      const onDrawOverlayPointerUp = (event: PointerEvent) => {
        if (!drawToolRef.current) return

        const shapeTool = drawToolRef.current
        const coarseShape =
          shapeTool && isShapeDrawTool(shapeTool) && isCoarsePointer(event)

        if (coarseShape) {
          const phase = touchShapePhaseRef.current
          releaseCapture(event)
          tapStartRef.current = null
          skipNextClickRef.current = true

          if (phase === 'dragging_p2') {
            const p1 = draftRef.current
            const p2 = clickToPoint(handle, localPoint(event), candlesRef.current)
            const dragStart = touchShapeDragStartRef.current
            touchShapeDragStartRef.current = null
            if (p1 && p2 && dragStart) {
              const moved = Math.hypot(
                event.clientX - dragStart.x,
                event.clientY - dragStart.y,
              )
              if (moved >= MIN_SHAPE_COMMIT_PX) {
                const kind = shapeTool
                clearDrafts()
                onCompleteRef.current?.({ kind, p1, p2 })
              } else {
                touchShapePhaseRef.current = 'has_p1'
                setActiveDraft({ p1 })
              }
            }
            syncInteractionLock()
            return
          }

          if (phase === 'has_p1') {
            syncInteractionLock()
            return
          }
        }

        releaseCapture(event)

        const tap = tapStartRef.current
        tapStartRef.current = null
        if (!tap || tap.pointerId !== event.pointerId) return

        const moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y)
        const tool = drawToolRef.current
        if (tool && isPolylineArrowKind(tool)) {
          skipNextClickRef.current = true
          handleChartTap(localPoint(event), event.clientX, event.clientY)
          syncInteractionLock()
          return
        }
        if (moved > TAP_MOVE_THRESHOLD_PX) return

        skipNextClickRef.current = true
        handleChartTap(localPoint(event), event.clientX, event.clientY)
        syncInteractionLock()
      }

      const onDrawOverlayPointerCancel = (event: PointerEvent) => {
        if (!drawToolRef.current) return
        tapStartRef.current = null
        if (touchShapePhaseRef.current === 'dragging_p2') {
          touchShapePhaseRef.current = 'has_p1'
          touchShapeDragStartRef.current = null
          const p1 = draftRef.current
          if (p1) setActiveDraft({ p1 })
        }
        releaseCapture(event)
        syncInteractionLock()
      }

      const onChartPointerDown = (event: PointerEvent) => {
        if (drawToolRef.current) return
        applyPointerHitBoost(event)
        tapStartRef.current = {
          x: event.clientX,
          y: event.clientY,
          pointerId: event.pointerId,
        }

        syncDrawingHitGeometry()
        const point = localPoint(event)
        const iconHit = handle.icons.hitTest(point.x, point.y)
        if (iconHit?.externalId && !iconHit.externalId.startsWith('temp-')) {
          selectDrawing(iconHit.externalId)
          iconPressRef.current = {
            id: iconHit.externalId,
            x: event.clientX,
            y: event.clientY,
            pointerId: event.pointerId,
          }
          return
        }

        const selectedId = selectedIdRef.current
        if (!selectedId || selectedId.startsWith('temp-')) return
        const polyAnchor = handle.polylines.hitTestAnchor(point.x, point.y)
        if (polyAnchor && polyAnchor.id === selectedId) {
          const poly = handle.polylines.getDrawing(selectedId)
          if (poly && poly.points.length >= 2) {
            event.preventDefault()
            polylineDragRef.current = {
              id: selectedId,
              vertexIndex: polyAnchor.vertexIndex,
              points: poly.points.map((p) => ({ ...p })),
            }
            setCapture(event, chartEl)
            syncInteractionLock()
            return
          }
        }

        let anchor =
          handle.trendlines.hitTestAnchor(point.x, point.y) ??
          handle.rectangles.hitTestAnchor(point.x, point.y) ??
          handle.icons.hitTestAnchor(point.x, point.y)
        if (!anchor || anchor.id !== selectedId) return
        const points = drawingPoints(anchor.id)
        if (!points) return
        const moveWhole = handle.icons.getDrawing(anchor.id) != null
        event.preventDefault()
        dragRef.current = {
          id: anchor.id,
          endpoint: anchor.endpoint,
          p1: points.p1,
          p2: points.p2,
          moveWhole,
        }
        setCapture(event, chartEl)
        syncInteractionLock()
      }

      const onChartPointerMove = (event: PointerEvent) => {
        if (drawToolRef.current) return
        const point = localPoint(event)
        const press = iconPressRef.current
        if (
          !dragRef.current &&
          press &&
          press.pointerId === event.pointerId
        ) {
          const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y)
          if (moved > TAP_MOVE_THRESHOLD_PX) {
            const points = drawingPoints(press.id)
            if (points) {
              didDragRef.current = true
              dragRef.current = {
                id: press.id,
                endpoint: 'p1',
                p1: points.p1,
                p2: points.p2,
                moveWhole: true,
              }
              iconPressRef.current = null
              setCapture(event, chartEl)
              syncInteractionLock()
            }
          }
        }

        const polyDrag = polylineDragRef.current
        if (polyDrag) {
          const next = clickToPoint(handle, point, candlesRef.current)
          if (!next) return
          didDragRef.current = true
          const points = polyDrag.points.map((p) => ({ ...p }))
          points[polyDrag.vertexIndex] = next
          polyDrag.points = points
          onPolylineChangeRef.current?.(polyDrag.id, points)
          return
        }

        const drag = dragRef.current
        if (drag) {
          const next = clickToPoint(handle, point, candlesRef.current)
          if (!next) return
          didDragRef.current = true
          if (drag.moveWhole) {
            drag.p1 = next
            drag.p2 = next
            onChangeRef.current?.(drag.id, next, next)
          } else {
            const p1 = drag.endpoint === 'p1' ? next : drag.p1
            const p2 = drag.endpoint === 'p2' ? next : drag.p2
            drag.p1 = p1
            drag.p2 = p2
            onChangeRef.current?.(drag.id, p1, p2)
          }
          return
        }
      }

      const onChartPointerUp = (event: PointerEvent) => {
        if (drawToolRef.current) return
        iconPressRef.current = null
        const polyDrag = polylineDragRef.current
        if (polyDrag) {
          const id = polyDrag.id
          polylineDragRef.current = null
          releaseCapture(event)
          syncInteractionLock()
          onPolylineChangeEndRef.current?.(id)
          tapStartRef.current = null
          return
        }
        const drag = dragRef.current
        if (drag) {
          const id = drag.id
          dragRef.current = null
          releaseCapture(event)
          syncInteractionLock()
          onChangeEndRef.current?.(id)
          tapStartRef.current = null
          return
        }

        releaseCapture(event)

        const tap = tapStartRef.current
        tapStartRef.current = null
        if (!tap || tap.pointerId !== event.pointerId) return

        const moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y)
        if (moved > TAP_MOVE_THRESHOLD_PX) return

        skipNextClickRef.current = true
        handleChartTap(localPoint(event), event.clientX, event.clientY)
        syncInteractionLock()
      }

      const onDoubleClick = (event: MouseEvent) => {
        if (drawToolRef.current) return
        const target = event.target as HTMLElement | null
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return
        }
        syncDrawingHitGeometry()
        const point = localPoint(event as unknown as PointerEvent)
        const polyHit = handle.polylines.hitTest(point.x, point.y)
        if (!polyHit?.externalId) return
        event.preventDefault()
        selectDrawing(polyHit.externalId)
        onPolylineLabelEditRef.current?.(polyHit.externalId)
      }

      const onChartPointerCancel = (event: PointerEvent) => {
        if (drawToolRef.current) return
        tapStartRef.current = null
        iconPressRef.current = null
        if (polylineDragRef.current) {
          const id = polylineDragRef.current.id
          polylineDragRef.current = null
          releaseCapture(event)
          syncInteractionLock()
          onPolylineChangeEndRef.current?.(id)
          return
        }
        if (!dragRef.current) {
          releaseCapture(event)
          syncInteractionLock()
          return
        }
        const id = dragRef.current.id
        dragRef.current = null
        releaseCapture(event)
        syncInteractionLock()
        onChangeEndRef.current?.(id)
      }

      const pointerOpts: AddEventListenerOptions = { passive: false }
      chartEl.addEventListener('pointerdown', onChartPointerDown, pointerOpts)
      chartEl.addEventListener('pointermove', onChartPointerMove)
      chartEl.addEventListener('pointerup', onChartPointerUp, pointerOpts)
      chartEl.addEventListener('pointercancel', onChartPointerCancel, pointerOpts)
      chartEl.addEventListener('dblclick', onDoubleClick)
      if (drawOverlayEl) {
        drawOverlayEl.addEventListener('pointerdown', onDrawOverlayPointerDown, pointerOpts)
        drawOverlayEl.addEventListener('pointermove', onDrawOverlayPointerMove)
        drawOverlayEl.addEventListener('pointerup', onDrawOverlayPointerUp, pointerOpts)
        drawOverlayEl.addEventListener('pointercancel', onDrawOverlayPointerCancel, pointerOpts)
      }
      syncDrawOverlay()
      removePointerHandlers = () => {
        chartElRef.current = null
        pointerCaptureElRef.current = null
        chartEl.removeEventListener('pointerdown', onChartPointerDown, pointerOpts)
        chartEl.removeEventListener('pointermove', onChartPointerMove)
        chartEl.removeEventListener('pointerup', onChartPointerUp, pointerOpts)
        chartEl.removeEventListener('pointercancel', onChartPointerCancel, pointerOpts)
        chartEl.removeEventListener('dblclick', onDoubleClick)
        if (drawOverlayEl) {
          drawOverlayEl.removeEventListener('pointerdown', onDrawOverlayPointerDown, pointerOpts)
          drawOverlayEl.removeEventListener('pointermove', onDrawOverlayPointerMove)
          drawOverlayEl.removeEventListener('pointerup', onDrawOverlayPointerUp, pointerOpts)
          drawOverlayEl.removeEventListener(
            'pointercancel',
            onDrawOverlayPointerCancel,
            pointerOpts,
          )
        }
      }
      if (cancelled) {
        removePointerHandlers()
        created.remove()
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
  }, [chartType])

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
    clearDrafts()
    if (drawTool) selectDrawing(null)
  }, [drawTool, epoch])

  // Freeze pan/zoom/crosshair while placing or dragging endpoints.
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

    const scale = handle.chart.timeScale()
    const keep = handle.fitted ? scale.getVisibleLogicalRange() : null
    const previousFirst = handle.firstTime
    const prepended =
      previousFirst == null ? 0 : candles.filter((bar) => bar.time < previousFirst).length

    const bands = bollinger(candles)
    handle.price.setData(candles.map((bar, index) => pricePoint(bar, bands.levels[index], chartType)))
    handle.upper.setData(bands.upper)
    handle.middle.setData(bands.middle)
    handle.lower.setData(bands.lower)
    // Re-apply after setData so overlay coords resolve on first paint.
    handle.forceOverlay.setEvents(forceEvents)
    handle.engulfingOverlay.setEvents(engulfingEvents)
    syncDrawingBars(handle, candles)
    handle.firstTime = candles[0].time
    if (keep) {
      scale.setVisibleLogicalRange({ from: keep.from + prepended, to: keep.to + prepended })
    } else {
      const to = candles.length + VIEWPORT.futureLogicalBars
      const range = { from: Math.max(0, to - VIEWPORT.visibleBars), to }
      scale.setVisibleLogicalRange(range)
      handle.fitted = true
      requestAnimationFrame(() => {
        if (handleRef.current !== handle) return
        scale.setVisibleLogicalRange(range)
      })
    }
  }, [candles, chartType, epoch, forceEvents, engulfingEvents])

  return (
    <div className="relative h-full min-h-0 w-full">
      <div ref={ref} className="h-full min-h-0 w-full" />
      <div
        ref={drawOverlayRef}
        className={`absolute inset-0 z-10 touch-none${drawTool ? ' cursor-crosshair' : ''}`}
        style={{ pointerEvents: drawTool ? 'auto' : 'none' }}
        aria-hidden={!drawTool}
      />
    </div>
  )
}
