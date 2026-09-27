'use client'

import { useEffect, useRef, useState } from 'react'
import type { Time } from 'lightweight-charts'
import type { CloudPoint, LinePoint } from '@/lib/ticks/ichimoku'
import type { LightweightCandle } from '@/lib/ticks/candles'
import { IchimokuCloud } from '@/components/ichimoku-cloud'

export type ChartType = 'line' | 'area' | 'candlestick' | 'bar'

const PRICE_FORMAT = { type: 'price' as const, precision: 5, minMove: 0.00001 }
const VISIBLE_BARS = 256
const MAX_VISIBLE_BARS = 1000
const LOAD_EDGE = 50

type PriceSeries = {
  setData: (data: readonly object[]) => void
  attachPrimitive: (primitive: IchimokuCloud) => void
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
  conversion: LineSeries
  base: LineSeries
  cloud: IchimokuCloud
  fitted: boolean
  firstTime: number | null
}

export function PriceChart({
  candles,
  conversion,
  base,
  cloud,
  chartType,
  onLoadOlder,
  axesVisible,
}: {
  candles: LightweightCandle[]
  conversion: LinePoint[]
  base: LinePoint[]
  cloud: CloudPoint[]
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

      const cloudPrimitive = new IchimokuCloud([])
      price.attachPrimitive(cloudPrimitive)

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
        conversion: line('#1565C0') as LineSeries,
        base: line('#E65100') as LineSeries,
        cloud: cloudPrimitive,
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

    const lastTime = candles[candles.length - 1].time
    const pad = cloud
      .map((point) => point.time)
      .filter((time) => time > lastTime)
      .sort((a, b) => a - b)
      .filter((time, index, all) => index === 0 || time !== all[index - 1])
      .map((time) => ({ time: time as Time }))

    const scale = handle.chart.timeScale()
    const keep = handle.fitted ? scale.getVisibleLogicalRange() : null
    const previousFirst = handle.firstTime
    const prepended =
      previousFirst == null ? 0 : candles.filter((bar) => bar.time < previousFirst).length

    handle.cloud.setCloud(cloud)
    if (chartType === 'line' || chartType === 'area') {
      handle.price.setData([
        ...candles.map((bar) => ({ time: bar.time as Time, value: bar.close })),
        ...pad,
      ])
    } else {
      handle.price.setData([
        ...candles.map((bar) => ({
          time: bar.time as Time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        })),
        ...pad,
      ])
    }
    handle.conversion.setData(conversion.map((point) => ({ time: point.time as Time, value: point.value })))
    handle.base.setData(base.map((point) => ({ time: point.time as Time, value: point.value })))
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
  }, [base, candles, chartType, cloud, conversion, epoch])

  return <div ref={ref} className="h-full min-h-0 w-full" />
}
