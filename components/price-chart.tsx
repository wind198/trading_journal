'use client'

import { useEffect, useRef, useState } from 'react'
import type { IChartApi, ISeriesApi, SeriesType, Time } from 'lightweight-charts'
import type { LightweightCandle } from '@/lib/ticks/candles'
import type { ChartDrawingKind, DrawingPoint } from '@/lib/chart-drawings'
import { RectanglePrimitive, type RectangleDrawing } from '@/components/rectangle-primitive'
import { TrendlinePrimitive, type TrendlineDrawing } from '@/components/trendline-primitive'

export type ChartType = 'line' | 'area' | 'candlestick' | 'bar'
export type DrawTool = ChartDrawingKind | null

const PRICE_FORMAT = { type: 'price' as const, precision: 5, minMove: 0.00001 }
const VISIBLE_BARS = 256
const MAX_VISIBLE_BARS = 1000
const LOAD_EDGE = 50
const BB_LENGTH = 104
const BB_MULT = 2
const ABOVE_BAND = '#26a69a'
const BELOW_BAND = '#ef5350'

type PriceSeries = {
  setData: (data: readonly object[]) => void
  attachPrimitive: (primitive: TrendlinePrimitive | RectanglePrimitive) => void
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
  fitted: boolean
  firstTime: number | null
}

type BandLevel = { upper: number; middle: number; lower: number }

function bollinger(candles: LightweightCandle[]) {
  const upper: { time: Time; value: number }[] = []
  const middle: { time: Time; value: number }[] = []
  const lower: { time: Time; value: number }[] = []
  const levels: (BandLevel | null)[] = Array.from({ length: candles.length }, () => null)
  for (let i = BB_LENGTH - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - BB_LENGTH + 1; j <= i; j++) sum += candles[j].close
    const mean = sum / BB_LENGTH
    let variance = 0
    for (let j = i - BB_LENGTH + 1; j <= i; j++) {
      const delta = candles[j].close - mean
      variance += delta * delta
    }
    const deviation = Math.sqrt(variance / BB_LENGTH)
    const time = candles[i].time as Time
    const level = {
      upper: mean + BB_MULT * deviation,
      middle: mean,
      lower: mean - BB_MULT * deviation,
    }
    levels[i] = level
    middle.push({ time, value: level.middle })
    upper.push({ time, value: level.upper })
    lower.push({ time, value: level.lower })
  }
  return { upper, middle, lower, levels }
}

function outsideColor(close: number, level: BandLevel | null): string | null {
  if (!level) return null
  if (close > level.upper) return ABOVE_BAND
  if (close < level.lower) return BELOW_BAND
  return null
}

function pricePoint(bar: LightweightCandle, level: BandLevel | null, chartType: ChartType) {
  const time = bar.time as Time
  const color = outsideColor(bar.close, level)
  if (chartType === 'line') {
    return color ? { time, value: bar.close, color } : { time, value: bar.close }
  }
  if (chartType === 'area') {
    if (!color) return { time, value: bar.close }
    const fill = color === ABOVE_BAND ? 'rgba(38, 166, 154, 0.35)' : 'rgba(239, 83, 80, 0.35)'
    const fade = color === ABOVE_BAND ? 'rgba(38, 166, 154, 0.02)' : 'rgba(239, 83, 80, 0.02)'
    return { time, value: bar.close, lineColor: color, topColor: fill, bottomColor: fade }
  }
  const candle = {
    time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  }
  if (!color) return candle
  if (chartType === 'bar') return { ...candle, color }
  return { ...candle, color, borderColor: color, wickColor: color }
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
  drawTool = null,
  onDrawingComplete,
  onDrawingDelete,
}: {
  candles: LightweightCandle[]
  chartType: ChartType
  onLoadOlder?: () => void
  axesVisible: boolean
  trendlines?: readonly TrendlineDrawing[]
  rectangles?: readonly RectangleDrawing[]
  drawTool?: DrawTool
  onDrawingComplete?: (input: {
    kind: ChartDrawingKind
    p1: DrawingPoint
    p2: DrawingPoint
  }) => void
  onDrawingDelete?: (id: string) => void
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
  const [epoch, setEpoch] = useState(0)
  candlesRef.current = candles ?? []
  onLoadOlderRef.current = onLoadOlder
  axesVisibleRef.current = axesVisible
  drawToolRef.current = drawTool
  onCompleteRef.current = onDrawingComplete
  onDeleteRef.current = onDrawingDelete

  const selectDrawing = (id: string | null) => {
    selectedIdRef.current = id
    const handle = handleRef.current
    if (!handle) return
    handle.trendlines.setSelectedId(id)
    handle.rectangles.setSelectedId(id)
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
          textColor: '#050F1A',
        },
        grid: {
          vertLines: { color: 'rgba(5, 15, 26, 0.06)' },
          horzLines: { color: 'rgba(5, 15, 26, 0.06)' },
        },
        timeScale: { timeVisible: true, secondsVisible: false, visible: axesVisibleRef.current },
        rightPriceScale: { borderVisible: false, visible: axesVisibleRef.current },
      })
      createdChart = created

      const price =
        chartType === 'candlestick'
          ? created.addSeries(lwc.CandlestickSeries, { priceFormat: PRICE_FORMAT })
          : chartType === 'bar'
            ? created.addSeries(lwc.BarSeries, { priceFormat: PRICE_FORMAT })
            : chartType === 'area'
              ? created.addSeries(lwc.AreaSeries, {
                  priceFormat: PRICE_FORMAT,
                  lineColor: '#050F1A',
                  topColor: 'rgba(5, 15, 26, 0.25)',
                  bottomColor: 'rgba(5, 15, 26, 0.02)',
                })
              : created.addSeries(lwc.LineSeries, {
                  priceFormat: PRICE_FORMAT,
                  color: '#050F1A',
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
      price.attachPrimitive(trendlinePrimitive)
      price.attachPrimitive(rectanglePrimitive)

      let adjusting = false
      created.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (!range || adjusting) return
        if (range.to - range.from > MAX_VISIBLE_BARS) {
          adjusting = true
          created.timeScale().setVisibleLogicalRange({
            from: range.to - MAX_VISIBLE_BARS,
            to: range.to,
          })
          adjusting = false
          return
        }
        if (range.from < LOAD_EDGE) onLoadOlderRef.current?.()
      })

      const handle: ChartHandle = {
        chart: created,
        price: price as unknown as PriceSeries & ISeriesApi<SeriesType, Time>,
        upper: line('#00897B') as LineSeries,
        middle: line('#00695C') as LineSeries,
        lower: line('#00897B') as LineSeries,
        trendlines: trendlinePrimitive,
        rectangles: rectanglePrimitive,
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
    clearDrafts()
    if (drawTool) selectDrawing(null)
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
    handle.firstTime = candles[0].time
    if (keep) {
      scale.setVisibleLogicalRange({ from: keep.from + prepended, to: keep.to + prepended })
    } else {
      const to = candles.length
      const range = { from: Math.max(0, to - VISIBLE_BARS), to }
      scale.setVisibleLogicalRange(range)
      handle.fitted = true
      requestAnimationFrame(() => {
        if (handleRef.current !== handle) return
        scale.setVisibleLogicalRange(range)
      })
    }
  }, [candles, chartType, epoch])

  return (
    <div
      ref={ref}
      className={`h-full min-h-0 w-full${drawTool ? ' cursor-crosshair' : ''}`}
    />
  )
}
