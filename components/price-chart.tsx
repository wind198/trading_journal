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

function dataPrice(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null
  const row = data as { value?: unknown; close?: unknown }
  if (typeof row.value === 'number' && Number.isFinite(row.value)) return row.value
  if (typeof row.close === 'number' && Number.isFinite(row.close)) return row.close
  return null
}

/** Prefer hovered series (e.g. BB band); else Y→price. */
function resolveClickPrice(
  handle: ChartHandle,
  point: { x: number; y: number },
  seriesData?: Map<unknown, unknown>,
  hoveredSeries?: unknown,
): number | null {
  try {
    if (seriesData instanceof Map && hoveredSeries != null && seriesData.has(hoveredSeries)) {
      const snapped = dataPrice(seriesData.get(hoveredSeries))
      if (snapped != null) return snapped
    }
    const fromY = handle.price.coordinateToPrice(point.y)
    return fromY == null ? null : Number(fromY)
  } catch {
    return null
  }
}

/** Resolve click → bar time + price (snap to hovered series when present, e.g. BB). */
function clickToPoint(
  handle: ChartHandle,
  point: { x: number; y: number },
  candles: readonly LightweightCandle[] | null | undefined,
  eventTime?: unknown,
  seriesData?: Map<unknown, unknown>,
  hoveredSeries?: unknown,
): DrawingPoint | null {
  try {
    const bars = candles ?? []
    let timeSec = asUnixSeconds(eventTime)
    if (timeSec == null) {
      timeSec = asUnixSeconds(handle.chart.timeScale().coordinateToTime(point.x))
    }
    if (timeSec == null && bars.length > 0) {
      const logical = handle.chart.timeScale().coordinateToLogical(point.x)
      if (logical != null && Number.isFinite(logical)) {
        const index = Math.max(0, Math.min(bars.length - 1, Math.round(logical)))
        timeSec = bars[index]?.time ?? null
      }
    }
    if (timeSec == null) return null

    const price = resolveClickPrice(handle, point, seriesData, hoveredSeries)
    if (price == null) return null
    return { time: timeSec, price }
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
  const selectedIdRef = useRef<string | null>(null)
  const onCompleteRef = useRef(onDrawingComplete)
  const onDeleteRef = useRef(onDrawingDelete)
  const onSelectionChangeRef = useRef(onSelectionChange)
  const [epoch, setEpoch] = useState(0)
  candlesRef.current = candles ?? []
  onLoadOlderRef.current = onLoadOlder
  axesVisibleRef.current = axesVisible
  drawToolRef.current = drawTool
  onCompleteRef.current = onDrawingComplete
  onDeleteRef.current = onDrawingDelete
  onSelectionChangeRef.current = onSelectionChange

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
    let removePointerMove: (() => void) | null = null

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

      const pointFromEvent = (param: {
        point?: { x: number; y: number }
        time?: unknown
        seriesData?: Map<unknown, unknown>
        hoveredInfo?: { series?: unknown }
        hoveredSeries?: unknown
      }) => {
        if (!param.point) return null
        return clickToPoint(
          handle,
          param.point,
          candlesRef.current,
          param.time,
          param.seriesData,
          param.hoveredInfo?.series ?? param.hoveredSeries,
        )
      }

      created.subscribeClick((param) => {
        if (!param.point) return
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

      const updateDraftPreview = (param: {
        point?: { x: number; y: number }
        time?: unknown
        seriesData?: Map<unknown, unknown>
        hoveredInfo?: { series?: unknown }
        hoveredSeries?: unknown
      }) => {
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
      const onPointerMove = (event: PointerEvent) => {
        if (!drawToolRef.current || !draftRef.current) return
        const rect = chartEl.getBoundingClientRect()
        updateDraftPreview({
          point: { x: event.clientX - rect.left, y: event.clientY - rect.top },
        })
      }
      chartEl.addEventListener('pointermove', onPointerMove)
      removePointerMove = () => chartEl.removeEventListener('pointermove', onPointerMove)
      if (cancelled) {
        removePointerMove()
        created.remove()
        return
      }

      setEpoch((value) => value + 1)
    })

    return () => {
      cancelled = true
      removePointerMove?.()
      handleRef.current = null
      draftRef.current = null
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

  // Freeze pan/zoom/crosshair and block selecting existing drawings while placing.
  useEffect(() => {
    const handle = handleRef.current
    if (!handle) return
    const drawing = drawTool != null
    handle.chart.applyOptions({
      handleScroll: !drawing,
      handleScale: !drawing,
      kineticScroll: { mouse: !drawing, touch: !drawing },
      crosshair: {
        // CrosshairMode.Hidden = 2, Magnet = 1 (typings; avoid static enum import)
        mode: drawing ? 2 : 1,
      },
    })
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
