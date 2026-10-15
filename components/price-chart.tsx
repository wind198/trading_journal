'use client'

import { useEffect, useRef, useState } from 'react'
import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { LightweightCandle } from '@/lib/ticks/candles'
import type { ChartDrawingKind, DrawingPoint } from '@/lib/chart-drawings'
import {
  formatChartCrosshairTime,
  formatChartTickMark,
} from '@/lib/chart-timezone'
import {
  BOLLINGER,
  CANDLE,
  CHART_THEME,
  PRICE_FORMAT,
  VIEWPORT,
} from '@/lib/price-chart-style'
import { bollinger, pricePoint, type ChartType } from '@/lib/price-chart-series'
import {
  EngulfingOverlayPrimitive,
  type EngulfingOverlayEvent,
} from '@/components/engulfing-overlay-primitive'
import {
  ForceOverlayPrimitive,
  type ForceOverlayEvent,
} from '@/components/force-overlay-primitive'
import { RectanglePrimitive, type RectangleDrawing } from '@/components/rectangle-primitive'
import { TrendlinePrimitive, type TrendlineDrawing } from '@/components/trendline-primitive'

export type { ChartType }
export type DrawTool = ChartDrawingKind | null

type AnyPrimitive =
  | TrendlinePrimitive
  | RectanglePrimitive
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

type ChartHandle = {
  chart: IChartApi
  price: PriceSeries & ISeriesApi<SeriesType, Time>
  upper: LineSeries
  middle: LineSeries
  lower: LineSeries
  trendlines: TrendlinePrimitive
  rectangles: RectanglePrimitive
  forceOverlay: ForceOverlayPrimitive
  engulfingOverlay: EngulfingOverlayPrimitive
  fitted: boolean
  firstTime: number | null
}

function asUnixSeconds(time: unknown): number | null {
  return typeof time === 'number' && Number.isFinite(time) ? time : null
}

/** Time at pixel x without snapping to bar centers (linear interpolate on logical index). */
function timeAtCoordinate(
  handle: ChartHandle,
  x: number,
  bars: readonly LightweightCandle[],
): number | null {
  const logical = handle.chart.timeScale().coordinateToLogical(x)
  if (logical != null && Number.isFinite(logical) && bars.length >= 2) {
    const i0 = Math.floor(logical)
    const frac = logical - i0
    const t0 = bars[Math.max(0, Math.min(bars.length - 1, i0))]?.time
    const t1 = bars[Math.max(0, Math.min(bars.length - 1, i0 + 1))]?.time
    if (t0 != null && t1 != null) {
      if (i0 < 0) return t0 + logical * (t1 - t0)
      if (i0 >= bars.length - 1) {
        const last = bars.length - 1
        const prev = bars[last - 1].time
        const lastT = bars[last].time
        return lastT + (logical - last) * (lastT - prev)
      }
      return t0 + frac * (t1 - t0)
    }
  }
  if (logical != null && Number.isFinite(logical) && bars.length === 1) {
    return bars[0].time
  }
  return asUnixSeconds(handle.chart.timeScale().coordinateToTime(x))
}

/** Resolve click → time/price at cursor (no series or bar-center snap). */
function clickToPoint(
  handle: ChartHandle,
  point: { x: number; y: number },
  candles: readonly LightweightCandle[] | null | undefined,
): DrawingPoint | null {
  try {
    const bars = candles ?? []
    const timeSec = timeAtCoordinate(handle, point.x, bars)
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
  forceEvents = [],
  engulfingEvents = [],
  drawTool = null,
  onDrawingComplete,
  onDrawingChange,
  onDrawingChangeEnd,
  onDrawingDelete,
  onSelectionChange,
}: {
  candles: LightweightCandle[]
  chartType: ChartType
  onLoadOlder?: () => void
  axesVisible: boolean
  trendlines?: readonly TrendlineDrawing[]
  rectangles?: readonly RectangleDrawing[]
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
}) {
  const ref = useRef<HTMLDivElement>(null)
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
  } | null>(null)
  const didDragRef = useRef(false)
  const selectedIdRef = useRef<string | null>(null)
  const trendlinesRef = useRef(trendlines)
  const rectanglesRef = useRef(rectangles)
  const onCompleteRef = useRef(onDrawingComplete)
  const onChangeRef = useRef(onDrawingChange)
  const onChangeEndRef = useRef(onDrawingChangeEnd)
  const onDeleteRef = useRef(onDrawingDelete)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const [epoch, setEpoch] = useState(0)
  candlesRef.current = candles ?? []
  trendlinesRef.current = trendlines
  rectanglesRef.current = rectangles
  onLoadOlderRef.current = onLoadOlder
  axesVisibleRef.current = axesVisible
  drawToolRef.current = drawTool
  onCompleteRef.current = onDrawingComplete
  onChangeRef.current = onDrawingChange
  onChangeEndRef.current = onDrawingChangeEnd
  onDeleteRef.current = onDrawingDelete
  onSelectionChangeRef.current = onSelectionChange

  const syncInteractionLock = () => {
    const handle = handleRef.current
    if (!handle) return
    const locked = drawToolRef.current != null || dragRef.current != null
    handle.chart.applyOptions({
      handleScroll: !locked,
      handleScale: !locked,
      kineticScroll: { mouse: !locked, touch: !locked },
      crosshair: { mode: locked ? 2 : 1 },
    })
  }

  const drawingPoints = (id: string): { p1: DrawingPoint; p2: DrawingPoint } | null => {
    const fromTrend = trendlinesRef.current.find((d) => d.id === id)
    if (fromTrend) return { p1: fromTrend.p1, p2: fromTrend.p2 }
    const fromRect = rectanglesRef.current.find((d) => d.id === id)
    if (fromRect) return { p1: fromRect.p1, p2: fromRect.p2 }
    const handle = handleRef.current
    if (!handle) return null
    const line = handle.trendlines.getDrawing(id)
    if (line) return { p1: line.p1, p2: line.p2 }
    const rect = handle.rectangles.getDrawing(id)
    if (rect) return { p1: rect.p1, p2: rect.p2 }
    return null
  }

  const selectDrawing = (id: string | null) => {
    const changed = selectedIdRef.current !== id
    selectedIdRef.current = id
    const handle = handleRef.current
    handle?.trendlines.setSelectedId(id)
    handle?.rectangles.setSelectedId(id)
    if (changed) onSelectionChangeRef.current?.(id)
  }

  const clearDrafts = () => {
    draftRef.current = null
    const handle = handleRef.current
    handle?.trendlines.setDraft(null)
    handle?.rectangles.setDraft(null)
  }

  const setActiveDraft = (draft: { p1: DrawingPoint; p2?: DrawingPoint } | null) => {
    const tool = drawToolRef.current
    const handle = handleRef.current
    if (!handle || !tool) return
    if (tool === 'trendline') {
      handle.trendlines.setDraft(draft)
      handle.rectangles.setDraft(null)
    } else {
      handle.rectangles.setDraft(draft)
      handle.trendlines.setDraft(null)
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
      const forceOverlayPrimitive = new ForceOverlayPrimitive([])
      const engulfingOverlayPrimitive = new EngulfingOverlayPrimitive([])
      price.attachPrimitive(trendlinePrimitive)
      price.attachPrimitive(rectanglePrimitive)
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
        forceOverlay: forceOverlayPrimitive,
        engulfingOverlay: engulfingOverlayPrimitive,
        fitted: false,
        firstTime: null,
      }
      handleRef.current = handle

      const pointFromEvent = (param: { point?: { x: number; y: number } }) => {
        if (!param.point) return null
        return clickToPoint(handle, param.point, candlesRef.current)
      }

      created.subscribeClick((param) => {
        if (!param.point) return
        if (didDragRef.current) {
          didDragRef.current = false
          return
        }
        const tool = drawToolRef.current
        if (tool) {
          const point = pointFromEvent(param)
          if (!point) return
          const first = draftRef.current
          if (!first) {
            draftRef.current = point
            setActiveDraft({ p1: point })
            return
          }
          clearDrafts()
          onCompleteRef.current?.({ kind: tool, p1: first, p2: point })
          return
        }
        const lineHit = handle.trendlines.hitTest(param.point.x, param.point.y)
        const rectHit = handle.rectangles.hitTest(param.point.x, param.point.y)
        const hit =
          lineHit && rectHit
            ? (lineHit.distance ?? 0) <= (rectHit.distance ?? 0)
              ? lineHit
              : rectHit
            : (lineHit ?? rectHit)
        selectDrawing(hit?.externalId ?? null)
      })

      const updateDraftPreview = (param: { point?: { x: number; y: number } }) => {
        if (!drawToolRef.current) return
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
      const localPoint = (event: PointerEvent) => {
        const rect = chartEl.getBoundingClientRect()
        return { x: event.clientX - rect.left, y: event.clientY - rect.top }
      }

      const onPointerDown = (event: PointerEvent) => {
        if (drawToolRef.current) return
        const selectedId = selectedIdRef.current
        if (!selectedId || selectedId.startsWith('temp-')) return
        const point = localPoint(event)
        const anchor =
          handle.trendlines.hitTestAnchor(point.x, point.y) ??
          handle.rectangles.hitTestAnchor(point.x, point.y)
        if (!anchor || anchor.id !== selectedId) return
        const points = drawingPoints(anchor.id)
        if (!points) return
        event.preventDefault()
        dragRef.current = {
          id: anchor.id,
          endpoint: anchor.endpoint,
          p1: points.p1,
          p2: points.p2,
        }
        chartEl.setPointerCapture(event.pointerId)
        syncInteractionLock()
      }

      const onPointerMove = (event: PointerEvent) => {
        const point = localPoint(event)
        const drag = dragRef.current
        if (drag && !drawToolRef.current) {
          const next = clickToPoint(handle, point, candlesRef.current)
          if (!next) return
          didDragRef.current = true
          const p1 = drag.endpoint === 'p1' ? next : drag.p1
          const p2 = drag.endpoint === 'p2' ? next : drag.p2
          drag.p1 = p1
          drag.p2 = p2
          onChangeRef.current?.(drag.id, p1, p2)
          return
        }
        if (!drawToolRef.current || !draftRef.current) return
        updateDraftPreview({ point })
      }

      const finishDrag = (event: PointerEvent) => {
        if (!dragRef.current) return
        const id = dragRef.current.id
        dragRef.current = null
        try {
          chartEl.releasePointerCapture(event.pointerId)
        } catch {
          /* lost capture */
        }
        syncInteractionLock()
        onChangeEndRef.current?.(id)
      }

      chartEl.addEventListener('pointerdown', onPointerDown)
      chartEl.addEventListener('pointermove', onPointerMove)
      chartEl.addEventListener('pointerup', finishDrag)
      chartEl.addEventListener('pointercancel', finishDrag)
      removePointerHandlers = () => {
        chartEl.removeEventListener('pointerdown', onPointerDown)
        chartEl.removeEventListener('pointermove', onPointerMove)
        chartEl.removeEventListener('pointerup', finishDrag)
        chartEl.removeEventListener('pointercancel', finishDrag)
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
      dragRef.current = null
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
  }, [drawTool, epoch])

  useEffect(() => {
    if (!selectedIdRef.current) return
    const exists =
      trendlines.some((d) => d.id === selectedIdRef.current) ||
      rectangles.some((d) => d.id === selectedIdRef.current)
    if (!exists) selectDrawing(null)
  }, [trendlines, rectangles, epoch])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
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
    handle.firstTime = candles[0].time
    if (keep) {
      scale.setVisibleLogicalRange({ from: keep.from + prepended, to: keep.to + prepended })
    } else {
      const to = candles.length
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
    <div
      ref={ref}
      className={`h-full min-h-0 w-full${drawTool ? ' cursor-crosshair' : ''}`}
    />
  )
}
