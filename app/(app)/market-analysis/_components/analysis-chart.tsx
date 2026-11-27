'use client'

import { useEffect, useRef } from 'react'
import { CandlestickSeries, LineSeries, createChart, ColorType, type UTCTimestamp } from 'lightweight-charts'
import type { WorkspaceAnalysis } from '@/lib/market-analysis/workspace'
import type { Timeframe } from '@/lib/market-analysis/contracts'

export type AnalysisView = 'overview' | 'trend' | 'range' | 'momentum' | 'transition'
const priceFormat = { type: 'price' as const, precision: 5, minMove: 0.00001 }

export function AnalysisChart({ data, timeframe, view }: { data: WorkspaceAnalysis; timeframe: Timeframe; view: AnalysisView }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = host.current
    const bars = data.snapshot.bars[timeframe]
    if (!node || !bars.length) return
    const css = getComputedStyle(node)
    const color = (name: string) => css.getPropertyValue(name).trim()
    const chart = createChart(node, {
      width: node.clientWidth, height: node.clientHeight,
      layout: { background: { type: ColorType.Solid, color: color('--card') }, textColor: color('--foreground') },
      grid: { vertLines: { color: color('--border') }, horzLines: { color: color('--border') } },
      timeScale: { timeVisible: true, secondsVisible: false },
    })
    const times = bars.map(b => Date.parse(b.closeTime) / 1000 as UTCTimestamp)
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: color('--success'), downColor: color('--destructive'), borderVisible: false,
      wickUpColor: color('--success'), wickDownColor: color('--destructive'), priceFormat,
    })
    candle.setData(bars.map((b,i) => ({ time: times[i], open:b.open, high:b.high, low:b.low, close:b.close })))
    const f = data.indicators[timeframe]
    const add = (values: readonly (number|null)[], token: string, title: string, pane = 0) => {
      const line = chart.addSeries(LineSeries, { color: color(token), title, lineWidth: 1,
        lastValueVisible: true, priceLineVisible: false, ...(pane === 0 ? { priceFormat } : {}) }, pane)
      line.setData(values.map((value,i) => value === null ? { time: times[i] } : { time: times[i], value }))
    }
    if (view === 'trend') {
      add(f.ichimoku.tenkan,'--chart-1','Tenkan')
      add(f.ichimoku.kijun,'--chart-3','Kijun')
      add(f.ichimoku.alignedA,'--chart-2','Aligned span A')
      add(f.ichimoku.alignedB,'--chart-4','Aligned span B')
    } else if (view === 'range') {
      add(f.bollinger.upper,'--chart-1','Upper')
      add(f.bollinger.middle,'--chart-5','Middle')
      add(f.bollinger.lower,'--chart-1','Lower')
    } else if (view === 'momentum') {
      add(f.force,'--chart-1','Signed force',1)
    } else if (view === 'transition') {
      add(f.bollinger.bandwidth,'--chart-1','Bandwidth',1)
      add(f.atr,'--chart-3','ATR',2)
    } else {
      add(f.dmi.adx,'--chart-1','ADX',1)
      add(f.efficiencyRatio,'--chart-3','Efficiency',2)
    }
    chart.timeScale().fitContent()
    const observer = new ResizeObserver(() => chart.resize(node.clientWidth, node.clientHeight))
    observer.observe(node)
    return () => { observer.disconnect(); chart.remove() }
  }, [data,timeframe,view])
  return <div className="relative min-h-0 flex-1">
    <div ref={host} className="absolute inset-0" role="img" aria-label={timeframe+' completed candle chart, '+view+' indicators, UTC close timestamps'} />
    {!data.snapshot.bars[timeframe].length && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">No completed bars</div>}
  </div>
}
