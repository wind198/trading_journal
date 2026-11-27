'use client'

import { useEffect,useRef } from 'react'
import { CandlestickSeries, LineSeries, createChart, ColorType, type UTCTimestamp } from 'lightweight-charts'
import type { WorkspaceAnalysis } from '@/lib/market-analysis/workspace'
import type { TradeOption } from '@/lib/trade-evaluation/options'
import { setupAnnotations } from '@/lib/trade-evaluation/visual-review'

/** A separate read-only chart; the entry editing runtime is never reconfigured. */
export function SetupReviewChart({data,entry,option}:{data:WorkspaceAnalysis;entry:number;option:TradeOption}){
 const host=useRef<HTMLDivElement>(null),overlay=useRef<HTMLDivElement>(null)
 const tf=option.stopReference.timeframe
 useEffect(()=>{
  const node=host.current,layer=overlay.current
  const bars=data.snapshot.bars[tf].slice(-60)
  if(!node||!layer||!bars.length)return
  const css=getComputedStyle(node),color=(token:string)=>css.getPropertyValue(token).trim()
  const chart=createChart(node,{width:node.clientWidth,height:node.clientHeight,
   layout:{background:{type:ColorType.Solid,color:color('--card')},textColor:color('--foreground')},
   grid:{vertLines:{color:color('--border')},horzLines:{color:color('--border')}},
   timeScale:{timeVisible:true,secondsVisible:false,rightOffset:3},handleScroll:false,handleScale:false})
  const fmt={type:'price' as const,precision:5,minMove:data.snapshot.pointSize}
  const candle=chart.addSeries(CandlestickSeries,{upColor:color('--success'),downColor:color('--destructive'),borderVisible:false,wickUpColor:color('--success'),wickDownColor:color('--destructive'),priceFormat:fmt})
  candle.setData(bars.map(b=>({time:Date.parse(b.closeTime)/1000 as UTCTimestamp,open:b.open,high:b.high,low:b.low,close:b.close})))
  const a=setupAnnotations(option,entry,option.review.warnings,option.review.assessments.find(a=>a.timeframe===tf))
  const levels=[{price:entry,title:'Entry',token:'--primary'},{price:option.stopLossPrice,title:'SL −'+option.riskPoints+' pts',token:'--destructive'},{price:option.takeProfitPrice,title:'TP +'+option.rewardPoints+' pts',token:'--success'}]
  // Invisible line series include the setup endpoints in the autoscale range.
  const time=Date.parse(bars.at(-1)!.closeTime)/1000 as UTCTimestamp
  for(const l of levels){
   const anchor=chart.addSeries(LineSeries,{priceFormat:fmt,color:'transparent',lastValueVisible:false,priceLineVisible:false,crosshairMarkerVisible:false})
   anchor.setData([{time,value:l.price}])
   candle.createPriceLine({price:l.price,title:l.title,color:color(l.token),lineWidth:2,axisLabelVisible:true,lineVisible:true})
  }
  for(const l of a.levels)if(!levels.some(x=>x.price===l.price))
   candle.createPriceLine({price:l.price,title:l.label,color:color('--muted-foreground'),lineWidth:1,axisLabelVisible:false,lineVisible:true})
  chart.timeScale().fitContent()
  const risk=layer.querySelector<HTMLElement>('[data-region="risk"]')!,reward=layer.querySelector<HTMLElement>('[data-region="reward"]')!
  let frame=0
  function draw(){
   const ey=candle.priceToCoordinate(entry),sy=candle.priceToCoordinate(option.stopLossPrice),ty=candle.priceToCoordinate(option.takeProfitPrice)
   const height=chart.panes()[0]?.getHeight()??0
   const width=chart.timeScale().width()
   layer!.style.width=width+'px';layer!.style.height=height+'px'
   const region=(el:HTMLElement,y:number|null)=>{
    const valid=ey!==null&&y!==null&&height>0
    el.hidden=!valid
    if(valid){const top=Math.max(0,Math.min(height,Math.min(ey!,y!))),bottom=Math.max(0,Math.min(height,Math.max(ey!,y!)));el.style.top=top+'px';el.style.height=Math.max(0,bottom-top)+'px'}
   }
   region(risk,sy);region(reward,ty)
   // Labels never cover the price axis; collision avoidance uses 24px rows.
   const items=Array.from(layer!.querySelectorAll<HTMLElement>('[data-anchor-price]')).map(el=>({el,y:candle.priceToCoordinate(Number(el.dataset.anchorPrice))})).filter(x=>{
    x.el.hidden=x.y===null||x.y<0||x.y>height;return !x.el.hidden
   }).sort((x,y)=>x.y!-y.y!)
   let last=-24
   for(const item of items){
    const top=Math.max(0,item.y!-12,last+24)
    if(top+24>height){item.el.hidden=true;continue}
    item.el.style.top=top+'px';last=top
   }
   frame=requestAnimationFrame(draw)
  }
  const observer=new ResizeObserver(()=>chart.resize(node.clientWidth,node.clientHeight));observer.observe(node)
  frame=requestAnimationFrame(draw)
  return ()=>{cancelAnimationFrame(frame);observer.disconnect();chart.remove()}
 },[data,entry,option,tf])
 const annotations=setupAnnotations(option,entry,option.review.warnings,option.review.assessments.find(a=>a.timeframe===tf))
 return <figure className="m-0 min-w-0 border-y bg-card">
  <figcaption className="flex items-center justify-between gap-2 px-2 py-1 text-xs"><span>{tf} · {data.report.regimes[tf]} · last 60 closed bars</span><strong className="font-mono">R:R 1:{option.grossRewardRisk.toFixed(2)}</strong></figcaption>
  <div className="relative h-[clamp(200px,38dvh,340px)] overflow-hidden">
   <div ref={host} className="absolute inset-0" role="img" aria-label={tf+' candle chart with entry '+entry.toFixed(5)+', stop '+option.stopLossPrice.toFixed(5)+', target '+option.takeProfitPrice.toFixed(5)}/>
   <div ref={overlay} className="pointer-events-none absolute top-0 left-0 overflow-hidden" aria-hidden="true">
    <div data-region="risk" hidden className="absolute right-0 left-1/3 border-x border-destructive/40 bg-destructive/15"/>
    <div data-region="reward" hidden className="absolute right-0 left-1/3 border-x border-success/40 bg-success/15"/>
    {annotations.levels.map((l,i)=><span hidden key={'level'+i} data-anchor-price={l.price} className="absolute left-1 max-w-[92%] truncate rounded-sm border bg-card/95 px-1 text-[11px] leading-5 text-muted-foreground">{l.label}</span>)}
    {annotations.callouts.map(c=><span hidden key={c.dimension} data-anchor-price={c.price} className="absolute left-1 max-w-[92%] truncate rounded-sm border border-destructive/40 bg-card/95 px-1 text-[11px] leading-5">{c.label}{c.count>1?' +'+(c.count-1):''}</span>)}
   </div>
  </div>
  <div className="flex flex-wrap justify-between gap-1 px-2 py-1 font-mono text-xs"><span>Entry {entry.toFixed(5)}</span><span className="text-destructive">Risk −{option.riskPoints} pts</span><span className="text-success">Reward +{option.rewardPoints} pts</span></div>
 </figure>
}
