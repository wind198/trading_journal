'use client'

import { useEffect, useRef, useState } from 'react'
import { CandlestickSeries, LineSeries, createChart, ColorType, type UTCTimestamp, type ISeriesApi, type IPriceLine, type MouseEventParams } from 'lightweight-charts'
import type { WorkspaceAnalysis } from '@/lib/market-analysis/workspace'
import type { Timeframe } from '@/lib/market-analysis/contracts'

import type { TradeHypothesis, TradeLevel } from '@/lib/trade-evaluation/contracts'
import type { StrategyAssessment } from '@/lib/trade-evaluation/strategies'
import { visibleEntryMidpoint } from '@/lib/trade-evaluation/entry-selection'
import { normalizePrice } from '@/lib/trade-evaluation/hypothesis'

export type AnalysisView = 'price' | 'overview' | 'trend' | 'range' | 'momentum' | 'transition'
const priceFormat = { type: 'price' as const, precision: 5, minMove: 0.00001 }

export function AnalysisChart({ data, timeframe, view, hypothesis, armedLevel, onPick, assessment, showReferences, draftPrice, registerMidpoint }: {
  data: WorkspaceAnalysis; timeframe: Timeframe; view: AnalysisView
  hypothesis: TradeHypothesis; armedLevel: TradeLevel | null
  assessment?: StrategyAssessment; showReferences: boolean; draftPrice?: number
  registerMidpoint: (timeframe:Timeframe, reader:(()=>number|null)|null)=>void
  onPick: (level: TradeLevel, price: number, timeframe: Timeframe) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lines = useRef<IPriceLine[]>([])
  const [handleY,setHandleY]=useState<number|null>(null)
  const draftRef=useRef(draftPrice)
  const drag=useRef<{id:number;offset:number}|null>(null)
  const paneHeight=useRef(0)
  useEffect(()=>{draftRef.current=draftPrice;if(draftPrice===undefined)drag.current=null},[draftPrice])
  const interaction = useRef({ armedLevel, onPick })
  useEffect(() => { interaction.current = { armedLevel, onPick } }, [armedLevel, onPick])
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
    candleRef.current = candle
    const click = (event: MouseEventParams) => {
      const active = interaction.current
      if (!active.armedLevel || !event.point || event.paneIndex !== 0 || event.time === undefined) return
      const raw = candle.coordinateToPrice(event.point.y)
      if (raw === null) return
      const price = normalizePrice(raw, data.snapshot.pointSize)
      if (price !== null) active.onPick(active.armedLevel, price, timeframe)
    }
    chart.subscribeClick(click)
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
    } else if (view === 'overview') {
      add(f.dmi.adx,'--chart-1','ADX',1)
      add(f.efficiencyRatio,'--chart-3','Efficiency',2)
    }
    chart.timeScale().fitContent()
    registerMidpoint(timeframe,()=>visibleEntryMidpoint(bars,chart.timeScale().getVisibleLogicalRange(),data.snapshot.pointSize))
    // Price-scale coordinates can change during pan, zoom, resize or autoscale.
    // Track only while a draft exists; React ignores unchanged coordinates.
    let frame=0
    const syncHandle=()=>{
      const price=draftRef.current
      paneHeight.current=chart.panes()[0]?.getHeight()??0
      const y=price===undefined?null:candle.priceToCoordinate(price)
      setHandleY(y!==null&&y>=0&&y<=paneHeight.current?y:null)
      frame=requestAnimationFrame(syncHandle)
    }
    frame=requestAnimationFrame(syncHandle)
    const observer = new ResizeObserver(() => chart.resize(node.clientWidth, node.clientHeight))
    observer.observe(node)
    return () => { cancelAnimationFrame(frame); registerMidpoint(timeframe,null); drag.current=null; observer.disconnect(); chart.unsubscribeClick(click); candleRef.current = null; lines.current = []; chart.remove() }
  }, [data,timeframe,view])
  useEffect(() => {
    const candle = candleRef.current
    const node = host.current
    if (!candle || !node) return
    for (const line of lines.current) candle.removePriceLine(line)
    lines.current = []
    const css = getComputedStyle(node)
    const levels = [
      [draftPrice??hypothesis.entryPrice, draftPrice===undefined?'Entry':'Draft entry', '--primary'],
      [draftPrice===undefined?hypothesis.stopLossPrice:null, 'SL', '--destructive'],
      [draftPrice===undefined?hypothesis.takeProfitPrice:null, 'TP', '--success'],
    ] as const
    for (const [price,title,token] of levels) {
      if (price === null) continue
      lines.current.push(candle.createPriceLine({ price, title, color: css.getPropertyValue(token).trim(),
        lineWidth: 2, axisLabelVisible: true, lineVisible: true }))
    }
    // Market boundaries are snapshot evidence, independent of trade submission
    // and the optional SL/TP reference overlay.
    const classification=data.report.classifications[timeframe]
    if(classification.regime==='choppy'&&classification.displayRange){
      const outer=classification.displayRange
      const confidence=classification.boundaryConfidence==='established'?'':' ~'
      const addBoundary=(price:number,title:string,token:string)=>{
        lines.current.push(candle.createPriceLine({price,title,color:css.getPropertyValue(token).trim(),lineWidth:1,axisLabelVisible:true,lineVisible:true}))
      }
      if(outer.upper===outer.lower)addBoundary(outer.upper,'Flat range'+confidence,'--chart-3')
      else{
        addBoundary(outer.upper,'Outer high'+confidence,'--chart-3')
        addBoundary(outer.lower,'Outer low'+confidence,'--chart-3')
      }
      const inner=classification.choppy?.inner
      if(inner){
        if(inner.upper!==outer.upper)addBoundary(inner.upper,'Inner high'+(inner.validated?'':' ~'),'--chart-5')
        if(inner.lower!==outer.lower)addBoundary(inner.lower,'Inner low'+(inner.validated?'':' ~'),'--chart-5')
      }
    }
    if(showReferences&&assessment){
      const seen=new Set(levels.filter(([price])=>price!==null).map(([price])=>price!.toFixed(5)))
      const addReference=(price:number,title:string)=>{
        const key=price.toFixed(5)
        if(seen.has(key))return
        seen.add(key)
        lines.current.push(candle.createPriceLine({price,title,color:css.getPropertyValue('--muted-foreground').trim(),lineWidth:1,axisLabelVisible:true,lineVisible:true}))
      }
      for(const r of assessment.references) addReference(r.price,(r.kind==='stop'?'SL ref':'TP ref')+' · '+r.source)
      for(const z of (assessment.structure?.obstacles??[]).slice(0,3)){
        addReference(z.lower,'Obstacle lower');addReference(z.upper,'Obstacle upper')
      }
    }
  }, [hypothesis.entryPrice,hypothesis.stopLossPrice,hypothesis.takeProfitPrice,data,timeframe,view,assessment,showReferences,draftPrice])
  return <div className="relative min-h-0 flex-1">
    <div ref={host} className={armedLevel ? 'absolute inset-0 cursor-crosshair' : 'absolute inset-0'} role="img" aria-label={timeframe+' completed candle chart, '+view+' indicators, UTC close timestamps'} />
    {armedLevel==='entryPrice'&&draftPrice!==undefined&&handleY!==null&&<button type="button" aria-label={timeframe+' drag entry price'} title="Drag entry price"
      className="absolute left-1 right-16 z-10 h-8 -translate-y-1/2 touch-none cursor-ns-resize bg-transparent focus-visible:outline-2 focus-visible:outline-ring"
      style={{top:handleY}}
      onPointerDown={e=>{
        if(drag.current||e.button!==0)return
        e.preventDefault();e.stopPropagation()
        const node=host.current
        if(!node)return
        drag.current={id:e.pointerId,offset:e.clientY-node.getBoundingClientRect().top-handleY}
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={e=>{
        const d=drag.current,node=host.current,candle=candleRef.current
        if(!d||d.id!==e.pointerId||!node||!candle)return
        e.preventDefault();e.stopPropagation()
        const y=Math.max(0,Math.min(paneHeight.current-1,e.clientY-node.getBoundingClientRect().top-d.offset))
        const raw=candle.coordinateToPrice(y)
        const price=raw===null?null:normalizePrice(raw,data.snapshot.pointSize)
        if(price!==null)onPick('entryPrice',price,timeframe)
      }}
      onPointerUp={e=>{if(drag.current?.id===e.pointerId){drag.current=null;e.currentTarget.releasePointerCapture(e.pointerId)}}}
      onPointerCancel={()=>{drag.current=null}}
      onLostPointerCapture={()=>{drag.current=null}}
      onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();onPick('entryPrice',draftPrice+(e.key==='ArrowUp'?1:-1)*data.snapshot.pointSize,timeframe)}}}>
      <span className="absolute left-2 top-1/2 -translate-y-1/2 rounded border border-primary bg-card px-2 py-1 text-xs font-medium text-primary">↕ Entry</span>
    </button>}
    {!data.snapshot.bars[timeframe].length && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">No completed bars</div>}
  </div>
}
