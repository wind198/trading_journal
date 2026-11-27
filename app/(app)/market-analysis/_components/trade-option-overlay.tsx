'use client'
import {useEffect,useRef,useState} from 'react'
import type {PlottedSetup} from '@/lib/trade-evaluation/overlay-layout'
import {referenceLabel} from '@/lib/trade-evaluation/visual-review'
import {Button} from '@/components/ui/button'
export interface OverlayCoordinates{width:number;height:number;priceToY:(price:number)=>number|null}
export function TradeOptionOverlay({setups,entry,coordinates,onReview}:{setups:readonly PlottedSetup[];entry:number;coordinates:()=>OverlayCoordinates|null;onReview:(id:string)=>void}){
 const [active,setActive]=useState<string|null>(null)
 const [hover,setHover]=useState<string|null>(null)
 const layer=useRef<HTMLDivElement>(null)
 const boxes=useRef(new Map<string,HTMLDivElement>())
 const labels=useRef(new Map<string,HTMLButtonElement>())
 useEffect(()=>{
  let frame=0
  const draw=()=>{
   const c=coordinates()
   if(c&&layer.current){
    layer.current.style.width=c.width+'px';layer.current.style.height=c.height+'px'
    const width=Math.min(58,Math.max(20,(c.width*.52)/Math.max(1,setups.length)-4))
    const left=Math.max(0,c.width-8-(width+4)*setups.length)
    setups.forEach((s,i)=>{
     const node=boxes.current.get(s.option.id)
     const label=labels.current.get(s.option.id)
     const e=c.priceToY(entry),sl=c.priceToY(s.option.stopLossPrice),tp=c.priceToY(s.option.takeProfitPrice)
     if(!node)return
     if(e===null||sl===null||tp===null||Math.max(e,sl,tp)<0||Math.min(e,sl,tp)>c.height){node.style.display='none';if(label)label.style.display='none';return}
     node.style.display='block'
     // Attach to the outer SL edge, outside the risk/reward geometry.
     // Long: below SL. Short: above SL, so the reward area stays unobstructed.
     if(label){
      const y=sl>=e?sl+2:sl-22
      label.style.left=left+i*(width+4)+'px';label.style.width=width+'px'
      label.style.top=y+'px';label.style.display=y>=0&&y+20<=c.height?'block':'none'
     }
     const top=Math.min(e,sl,tp),bottom=Math.max(e,sl,tp)
     node.style.left=left+i*(width+4)+'px';node.style.width=width+'px'
     node.style.top=top+'px';node.style.height=Math.max(1,bottom-top)+'px'
     node.style.setProperty('--reward-top',(Math.min(e,tp)-top)+'px')
     node.style.setProperty('--reward-height',Math.abs(e-tp)+'px')
     node.style.setProperty('--risk-top',(Math.min(e,sl)-top)+'px')
     node.style.setProperty('--risk-height',Math.abs(e-sl)+'px')
    })
   }
   frame=requestAnimationFrame(draw)
  }
  frame=requestAnimationFrame(draw)
  return()=>cancelAnimationFrame(frame)
 },[setups,entry,coordinates])
 const selected=setups.find(s=>s.option.id===(hover??active))
 return <>
  <div ref={layer} className="pointer-events-none absolute left-0 top-0 z-10 overflow-hidden">
   {setups.map(s=><div key={s.option.id} ref={node=>{if(node)boxes.current.set(s.option.id,node);else boxes.current.delete(s.option.id)}} className="absolute pointer-events-none" style={{display:'none'}}>
    <div className={'absolute inset-x-0 border bg-success/10 '+(s.failed?'border-destructive border-dashed':'border-success')} style={{top:'var(--reward-top)',height:'var(--reward-height)'}}/>
    <div className={'absolute inset-x-0 border border-destructive bg-destructive/10 '+(s.failed?'border-dashed':'')} style={{top:'var(--risk-top)',height:'var(--risk-height)'}}/>
   </div>)}
   {setups.map(s=><button key={s.option.id} ref={node=>{if(node)labels.current.set(s.option.id,node);else labels.current.delete(s.option.id)}} type="button" aria-label={'Setup '+s.number+' '+(s.failed?'failed':'passed')+', show rationale'} aria-pressed={active===s.option.id}
     onPointerEnter={e=>{if(e.pointerType==='mouse')setHover(s.option.id)}} onPointerLeave={()=>setHover(null)}
     onFocus={()=>setHover(s.option.id)} onBlur={()=>setHover(null)}
     onClick={()=>setActive(v=>v===s.option.id?null:s.option.id)}
     className={'pointer-events-auto absolute z-10 h-5 rounded border bg-card text-[10px] font-semibold focus-visible:outline-2 focus-visible:outline-ring '+(s.failed?'border-destructive text-destructive':'border-success text-success')+(active===s.option.id?' ring-2 ring-primary':'')}
     style={{display:'none'}}>#{s.number} {s.failed?'×':'✓'}</button> )}
  </div>
  {selected&&<div role="region" aria-label={'Setup '+selected.number+' rationale'} className="absolute bottom-7 left-1 right-1 z-20 max-h-[65%] overflow-auto rounded-md border bg-card p-2 text-xs shadow-md sm:right-auto sm:max-w-80" onPointerEnter={()=>setHover(selected.option.id)} onPointerLeave={()=>setHover(null)}>
   <div className="flex items-center justify-between gap-2"><strong>#{selected.number} · {selected.failed?'Failed':'Passed'} · {selected.option.seed?.replaceAll('_',' ')??'Structural'}</strong><Button size="sm" variant="ghost" className="h-7 px-2" onClick={()=>{setActive(null);setHover(null)}}>Close</Button></div>
   <p className="font-mono">SL {selected.option.riskPoints} · TP {selected.option.rewardPoints} pts · R:R 1:{selected.option.grossRewardRisk.toFixed(2)}</p>
   <p>SL: {selected.option.stopReference.timeframe} · {referenceLabel(selected.option.stopReference)} {selected.option.stopReference.price.toFixed(5)}</p>
   <p>TP: {selected.option.targetReference.timeframe} · {referenceLabel(selected.option.targetReference)} {selected.option.targetReference.price.toFixed(5)}</p>
   <p className="text-muted-foreground">{selected.option.searchStage?.replaceAll('_',' ')} · {selected.option.stopReference.scale??'baseline'}</p>
   {selected.option.review.warnings.slice().sort((a,b)=>Number(b.severity==='block')-Number(a.severity==='block')).slice(0,3).map((w,i)=><p key={i} className={w.severity==='block'?'text-destructive':'text-muted-foreground'}>{w.message}</p>)}
   <Button size="sm" variant="outline" className="mt-1 h-8 w-full" onClick={()=>onReview(selected.option.id)}>Detailed review</Button>
  </div>}
 </>
}
