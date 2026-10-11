'use client'

import { useEffect, useRef, useState } from 'react'
import type { Time } from 'lightweight-charts'
import type { LightweightCandle } from '@/lib/ticks/candles'

export type ChartType = 'line' | 'area' | 'candlestick' | 'bar'

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
}

type LineSeries = {
  setData: (data: { time: Time; value: number }[]) => void
}

type LogicalRange = { from: number; to: number }

type ChartHandle = {
  chart: {
    applyOptions: (options: {
      timeScale: { visible: boolean }
      rightPriceScale: { visible: boolean }
    }) => void
    timeScale: () => {
      getVisibleLogicalRange: () => LogicalRange | null
      setVisibleLogicalRange: (range: LogicalRange) => void
    }
    remove: () => void
  }
  price: PriceSeries
  upper: LineSeries
  middle: LineSeries
  lower: LineSeries
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

export function PriceChart({
  candles,
  chartType,
  onLoadOlder,
  axesVisible,
}: {
  candles: LightweightCandle[]
  chartType: ChartType
  onLoadOlder?: () => void
  axesVisible: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const handleRef = useRef<ChartHandle | null>(null)
  const onLoadOlderRef = useRef(onLoadOlder)
  const axesVisibleRef = useRef(axesVisible)
  const [epoch, setEpoch] = useState(0)
  onLoadOlderRef.current = onLoadOlder
  axesVisibleRef.current = axesVisible

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let cancelled = false
    let createdChart: { remove: () => void } | null = null

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

      // Ichimoku cloud, tenkan, and kijun are not plotted.
      // const cloudPrimitive = new IchimokuCloud([])
      // price.attachPrimitive(cloudPrimitive)

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

      handleRef.current = {
        chart: created,
        price: price as unknown as PriceSeries,
        upper: line('#00897B') as LineSeries,
        middle: line('#00695C') as LineSeries,
        lower: line('#00897B') as LineSeries,
        fitted: false,
        firstTime: null,
      }
      setEpoch((value) => value + 1)
    })

    return () => {
      cancelled = true
      handleRef.current = null
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

  return <div ref={ref} className="h-full min-h-0 w-full" />
}
