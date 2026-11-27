'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TradeOptions, TradeOption } from '@/lib/trade-evaluation/options'
import type { WorkspaceAnalysis } from '@/lib/market-analysis/workspace'
import { optionTitle,referenceLabel } from '@/lib/trade-evaluation/visual-review'
import { failureComparisons,failureLabel,orderFailedOptions } from '@/lib/trade-evaluation/failure-visuals'
import { SetupReviewChart } from './setup-review-chart'

const messages:Record<TradeOptions['status'],string>={
  entry_required:'Select entry and direction on the chart.',
  context_unresolved:'Market context is unresolved; structural options withheld.',
  no_structural_pair:'No supported SL/TP reference pair found in a coherent strategy and timeframe.',
  no_feasible_option:'No evaluated structural combination satisfies the risk policy and available evidence.',
  options_available:'Structural alternatives, not ranked recommendations.',
}

export function TradeOptionsPanel({result,data,entry,onSelect}:{result:TradeOptions;data:WorkspaceAnalysis;entry:number|null;onSelect:(option:TradeOption)=>void}){
 const [selectedId,setSelectedId]=useState<string|null>(null)
 const [group,setGroup]=useState<'passed'|'failed'>(result.options.length?'passed':'failed')
 const [showAll,setShowAll]=useState(false)
 const failed=orderFailedOptions(result.failedOptions)
 const candidates=group==='passed'?result.options:showAll?failed:failed.slice(0,3)
 const selected=candidates.find(o=>o.id===selectedId)??candidates[0]
 const rejected=group==='failed'?failed.find(o=>o.id===selected?.id):undefined
 const global=result.entryReview.warnings.filter(w=>w.dimension==='entry'||w.dimension==='data')
 const warnings=selected?.review.warnings??[]
 return <section className="min-w-0 space-y-2 border-b pb-3">
  <div className="px-3 pt-3"><h2 className="text-sm font-semibold">Alternative setups</h2><p className="text-xs text-muted-foreground">{messages[result.status]}</p><p className="mt-1 text-xs text-muted-foreground">{result.options.length+result.failedOptions.length} / {result.search.target} setups · {result.search.elapsedMs} ms · {result.search.stopReason.replaceAll('_',' ').toLowerCase()}</p><details className="mt-1 text-xs"><summary>Search coverage</summary>{result.search.stages.map(s=><p key={s.stage}>{s.stage.replaceAll('_',' ')} · {s.found} found · {s.evaluated} evaluated</p>)}</details></div>
  <div className="flex gap-1 px-3" role="group" aria-label="Setup outcome">
   <Button size="sm" className="flex-1" variant={group==='passed'?'default':'outline'} aria-pressed={group==='passed'} disabled={!result.options.length} onClick={()=>{setGroup('passed');setSelectedId(null)}}>Passed · {result.options.length}</Button>
   <Button size="sm" className="flex-1" variant={group==='failed'?'default':'outline'} aria-pressed={group==='failed'} onClick={()=>{setGroup('failed');setSelectedId(null)}}>Failed · {failed.length}</Button>
  </div>
  {group==='failed'&&!failed.length&&<p className="px-3 text-xs text-muted-foreground">No complete structural setup to plot. The entry/data evidence below explains why references were withheld. No prices are invented.</p>}
  {group==='failed'&&result.unchartable>0&&<p className="px-3 text-xs text-muted-foreground">{result.unchartable} attempted combinations had invalid price geometry and cannot be drawn as complete setups.</p>}
  {candidates.length>0&&<div role="group" aria-label="Trade alternatives" className="flex gap-2 overflow-x-auto px-3 pb-1">
   {candidates.map((o,i)=><button type="button" key={o.id} aria-pressed={selected?.id===o.id} onClick={()=>setSelectedId(o.id)}
    className={'min-w-32 max-w-48 shrink-0 rounded-md border px-2 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-ring '+(selected?.id===o.id?'border-primary bg-muted':'bg-card')}>
    <span className="block font-semibold">{group==='failed'?'Failed':'Option'} {i+1} · 1:{o.grossRewardRisk.toFixed(2)}</span>
    <span className="block break-words text-muted-foreground">{optionTitle(o)} · {o.searchStage?.replaceAll('_',' ')}</span>
   </button>)}
  </div>}
  {group==='failed'&&failed.length>3&&<div className="px-3"><Button variant="ghost" size="sm" onClick={()=>{setShowAll(v=>!v);setSelectedId(null)}}>{showAll?'Show fewer':'Show all '+failed.length+' failed setups'}</Button></div>}
  {rejected&&<div role="status" className="mx-3 rounded-md border border-destructive/50 p-2 text-xs text-destructive"><strong>{failureLabel(rejected.failureState)}</strong><p>Diagnostic only — not eligible for preview or execution.</p></div>}
  {selected&&entry!==null&&<>
   <SetupReviewChart data={data} entry={entry} option={selected} failed={!!rejected}/>
   {rejected&&<div className="space-y-2 px-3 text-xs">
    {failureComparisons(rejected).map(v=>{const max=Math.max(v.actual,v.required,1);return <div key={v.id}>
      <div className="flex justify-between gap-2"><strong>{v.label}</strong><span className={v.failed?'text-destructive font-medium':'text-muted-foreground'}>{v.failed?'FAIL':'Meets limit'}</span></div>
      <div className="relative mt-1 h-3 rounded-sm bg-muted" role="img" aria-label={v.label+': actual '+v.actual.toFixed(v.unit?0:2)+', minimum '+v.required+' '+v.unit}>
       <div className={'h-full rounded-sm '+(v.failed?'bg-destructive':'bg-success')} style={{width:100*v.actual/max+'%'}}/>
       <div className="absolute top-0 bottom-0 border-l-2 border-foreground" style={{left:'min(calc(100% - 2px), '+100*v.required/max+'%)'}}/>
      </div>
      <p className="mt-1 text-muted-foreground">Actual {v.actual.toFixed(v.unit?0:2)} {v.unit} · Required {v.required} {v.unit}{v.failed?' · Shortfall '+(v.required-v.actual).toFixed(v.unit?0:2)+' '+v.unit:''}</p>
    </div>})}
   </div>}
   {selected.review.assessments.filter(a=>a.forceState).map(a=><div key={a.timeframe} className="space-y-1 px-3 py-1 text-xs">
    <p className="font-medium">{a.timeframe} · Force: {a.forceState!.replaceAll('_',' ')}</p>
    {[5,10,20].map(n=>{const bull=a.metrics['bullForce'+n],bear=a.metrics['bearForce'+n],sum=(bull??0)+(bear??0);return <div key={n} className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-muted-foreground">{n} bars</span>
      {bull!=null&&bear!=null&&sum>0?<><div className="flex h-2 flex-1 overflow-hidden rounded-sm bg-muted" aria-label={'Bull '+bull.toFixed(1)+' bear '+bear.toFixed(1)}><div className="bg-success" style={{width:100*bull/sum+'%'}}/><div className="bg-destructive" style={{width:100*bear/sum+'%'}}/></div><span className="font-mono">B {bull.toFixed(0)} / S {bear.toFixed(0)}</span></>:<span className="text-muted-foreground">{bull===0&&bear===0?'No measured force':'Unavailable'}</span>}
    </div>})}
   </div>)}
   <div className="space-y-1 px-3 text-xs">
    <p><strong>Stop anchor:</strong> {referenceLabel(selected.stopReference)} · {selected.stopReference.price.toFixed(5)}</p>
    <p><strong>Target anchor:</strong> {referenceLabel(selected.targetReference)} · {selected.targetReference.price.toFixed(5)}</p>
    <p className="text-muted-foreground">Structural alternatives, not a quality ranking or trade clearance.</p>
   </div>
  </>}
  {global.length>0&&<details open className="mx-3 rounded-md border p-2 text-xs">
   <summary className="cursor-pointer font-medium">Entry & data warnings · {global.length}</summary>
   {global.map((w,i)=><p key={w.code+':'+i} className="mt-1 flex gap-1"><AlertTriangle className="size-3.5 shrink-0 text-muted-foreground"/><span>{w.timeframe??'Context'} · {w.message}</span></p>)}
  </details>}
  {selected&&<>
   <details open className="mx-3 rounded-md border p-2 text-xs">
    <summary className="cursor-pointer font-medium">Setup warnings · {warnings.length}</summary>
    {warnings.length?warnings.map((w,i)=><p key={w.code+':'+i} className="mt-1 border-l pl-2">{w.timeframe??'Policy'} · {w.dimension} · {w.message}</p>):<p className="mt-1 text-muted-foreground">No warning detected; this does not establish safety.</p>}
   </details>
   {!rejected&&<div className="px-3"><Button className="h-10 w-full" variant="outline" onClick={()=>onSelect(selected)}>Keep preview on main charts</Button></div>}
  </>}
  <p className="px-3 text-xs text-muted-foreground">Experimental references and buffers. Costs and monetary exposure unassessed. No orders are submitted.</p>
 </section>
}
