'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, X, AlertTriangle, ChartNoAxesCombined, Crosshair, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { WorkspaceAnalysis } from '@/lib/market-analysis/workspace'
import type { TradeHypothesis } from '@/lib/trade-evaluation/contracts'
import type { AnalysisResult, Timeframe } from '@/lib/market-analysis/contracts'
import { createHypothesis, normalizePrice } from '@/lib/trade-evaluation/hypothesis'
import { confirmEntry, changeEntryDirection, refreshEntrySnapshot, type EntryDraft } from '@/lib/trade-evaluation/entry-selection'
import { generateTradeOptions } from '@/lib/trade-evaluation/options'
import { evaluateTrade } from '@/lib/trade-evaluation/evaluator'
import { TradeOptionsPanel } from './trade-options-panel'
import { TradeReviewPanel } from './trade-review-panel'
import { AnalysisChart, type AnalysisView } from './analysis-chart'

const views: {id:AnalysisView;label:string}[]=[{id:'price',label:'Price'},{id:'overview',label:'Overview'},{id:'trend',label:'Trend'},{id:'range',label:'Range'},{id:'transition',label:'Transition'},{id:'momentum',label:'Momentum'}]
const format = (value: number | null) => value === null ? 'Unavailable' : Number(value.toPrecision(7)).toString()
function EvidenceInspector({ result }: { result: AnalysisResult }) {
  return <details className="border-b last:border-b-0">
    <summary className="cursor-pointer px-3 py-2 focus-visible:outline-2 focus-visible:outline-ring">
      <span className="block break-words text-xs font-medium">{result.toolId.replaceAll('_',' ')} · {result.timeframe}</span>
      <span className="text-xs text-muted-foreground">{result.status.replaceAll('_',' ')}</span>
    </summary>
    <div className="space-y-2 px-3 pb-3 text-xs">
      <dl className="space-y-1">
        {Object.entries(result.features).map(([key,feature])=><div key={key} className="flex justify-between gap-2">
          <dt className="min-w-0 break-words text-muted-foreground">{key}</dt>
          <dd className="text-right font-mono">{format(feature.value)} {feature.unit}<span className="block text-muted-foreground">{feature.lookbackBars} bars</span></dd>
        </div>)}
      </dl>
      {result.evidence.map(e=><div key={e.id} className="break-all rounded-sm bg-muted p-2">
        <div>{e.id}</div><div>{e.from} — {e.through}</div><div>Calculation {e.calculationVersion} · config {e.configVersion}</div>
      </div>)}
      {result.limitations.map((l,i)=><p key={i} className="text-muted-foreground">{l}</p>)}
    </div>
  </details>
}


export function MarketAnalysisWorkspace(){
  const [data,setData]=useState<WorkspaceAnalysis|null>(null)
  const [hypothesis,setHypothesis]=useState<TradeHypothesis|null>(null)
  const [view,setView]=useState<AnalysisView>('price')
  const [showReferences,setShowReferences]=useState(false)
  const [pending,setPending]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [armed,setArmed]=useState(false)
  const [draft,setDraft]=useState<EntryDraft|null>(null)
  const [expanded,setExpanded]=useState<Timeframe|null>(null)
  const [sheet,setSheet]=useState<'review'|'evidence'|null>(null)
  const [manual,setManual]=useState<string|null>(null)
  const [manualError,setManualError]=useState(false)
  const active=useRef<AbortController|null>(null)
  const reviewButton=useRef<HTMLButtonElement>(null)
  const evidenceButton=useRef<HTMLButtonElement>(null)
  const returnFocus=useRef<'review'|'evidence'>('review')
  useEffect(()=>()=>active.current?.abort(),[])
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setArmed(false);setDraft(null);setManual(null);setManualError(false)}}
    window.addEventListener('keydown',key)
    return()=>window.removeEventListener('keydown',key)
  },[])
  function cancelPick(){setArmed(false);setDraft(null);setManual(null);setManualError(false)}
  async function run(){
    if(active.current)return
    const controller=new AbortController()
    active.current=controller;setPending(true);setError(null);cancelPick();setSheet(null)
    try{
      const response=await fetch('/api/market-analysis/scan',{method:'POST',signal:controller.signal,cache:'no-store'})
      if(!response.ok)throw new Error(response.status===401?'Session expired. Sign in again.':'Market scan failed. Retry.')
      const next=await response.json() as WorkspaceAnalysis
      if(!controller.signal.aborted){
        setData(next)
        setHypothesis(old=>old?refreshEntrySnapshot(old,next.snapshot.id):createHypothesis(crypto.randomUUID(),next.snapshot.id))
      }
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Market scan failed.')}
    finally{if(active.current===controller){active.current=null;setPending(false)}}
  }
  function cancel(){active.current?.abort();active.current=null;setPending(false)}
  const review=useMemo(()=>data&&hypothesis?evaluateTrade(data,hypothesis):null,[data,hypothesis])
  const options=useMemo(()=>data&&hypothesis?generateTradeOptions(data,hypothesis):null,[data,hypothesis])
  function stage(price:number,timeframe:Timeframe){
    if(!data||!hypothesis||pending)return
    const snapped=normalizePrice(price,data.snapshot.pointSize)
    if(snapped===null)return
    setDraft({price:snapped,timeframe,snapshotId:hypothesis.snapshotId,hypothesisId:hypothesis.id,revision:hypothesis.revision})
    setManual(null);setManualError(false)
  }
  function confirm(){
    if(!draft||!data||pending)return
    setHypothesis(h=>h?confirmEntry(h,draft,data.snapshot.pointSize):h)
    cancelPick()
  }
  function openSheet(which:'review'|'evidence'){cancelPick();returnFocus.current=which;setSheet(which)}
  const ready=!!data&&!!hypothesis
  return <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
    <header className="flex shrink-0 items-center justify-between gap-1 border-b bg-card px-2 py-1">
      <h1 className="truncate text-sm font-semibold">EURUSD · Analysis</h1>
      <div className="flex shrink-0 gap-1">
        {pending?<Button className="h-9" size="sm" variant="outline" onClick={cancel}><X/>Cancel</Button>:<Button className="h-9" size="sm" onClick={run}><Play/>{data?'Refresh':'Scan'}</Button>}
      </div>
    </header>
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-card px-2 py-1" role="group" aria-label="Chart indicators">
      <Button className="h-9" size="sm" variant={showReferences?'secondary':'ghost'} aria-pressed={showReferences} onClick={()=>setShowReferences(v=>!v)}>Refs</Button>
      {views.map(v=><Button className="h-9" key={v.id} size="sm" variant={view===v.id?'secondary':'ghost'} aria-pressed={view===v.id} onClick={()=>setView(v.id)}>{v.label}</Button>)}
    </div>
    <div aria-live="polite" className="shrink-0 truncate border-b px-2 py-1 text-[11px] text-muted-foreground" title={data?.snapshot.asOf}>
      {pending?'Scanning…'+(data?' previous snapshot shown':''):data?'Snapshot '+data.snapshot.asOf.replace('T',' ').slice(0,19)+' UTC':'Run a scan to begin.'}
    </div>
    {error&&<div role="alert" className="flex shrink-0 gap-1 border-b p-2 text-xs text-destructive"><AlertTriangle className="size-4 shrink-0"/>{error}{data?' Previous snapshot retained.':''}</div>}
    {!ready?<div className="grid min-h-0 flex-1 place-items-center p-4 text-center text-muted-foreground"><div><ChartNoAxesCombined className="mx-auto mb-2 size-8"/><p className="text-sm">Scan completed candles to choose an entry.</p></div></div>:null}
    {data&&hypothesis&&<>
      <div className={'grid min-h-0 min-w-0 flex-1 gap-px bg-border '+(expanded?'grid-cols-1 grid-rows-1':'grid-cols-1 grid-rows-2 landscape:grid-cols-2 landscape:grid-rows-1 md:grid-cols-2 md:grid-rows-1')}>
        {(['M15','M3'] as const).map(tf=><section key={tf} className={'min-h-0 min-w-0 flex-col bg-card '+(expanded&&expanded!==tf?'hidden':'flex')}>
          <div className="flex h-8 shrink-0 items-center gap-1 border-b px-2 text-xs">
            <span className="min-w-0 flex-1 truncate font-medium" title={data.report.classifications[tf].reason}>{tf} · {data.report.regimes[tf]}</span>
            <Button variant="ghost" size="icon-sm" className="size-8" aria-label={(expanded===tf?'Restore both charts':'Expand '+tf)} onClick={()=>setExpanded(expanded===tf?null:tf)}>{expanded===tf?<Minimize2/>:<Maximize2/>}</Button>
          </div>
          <AnalysisChart data={data} timeframe={tf} view={view} assessment={review?.assessments.find(a=>a.timeframe===tf)} showReferences={showReferences&&!draft} hypothesis={hypothesis} armedLevel={armed&&!pending?'entryPrice':null} draftPrice={draft?.price} onPick={(level,price,timeframe)=>{if(level==='entryPrice')stage(price,timeframe)}}/>
        </section>)}
      </div>
      <footer className="shrink-0 border-t bg-card px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <Input aria-label="Entry price" inputMode="decimal" className="h-9 font-mono text-sm" placeholder="Entry price" aria-invalid={manualError}
              value={manual??(draft?.price??hypothesis.entryPrice)?.toFixed(5)??''}
              onChange={e=>{setManual(e.target.value);setDraft(null);setManualError(false);setArmed(false)}}
              onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(manual!==null){const n=normalizePrice(Number(manual),data.snapshot.pointSize);if(n===null)setManualError(true);else stage(n,hypothesis.entryTimeframe)}else confirm()}}}/>
          </div>
          <Button className="h-9 px-2" variant={armed?'secondary':'outline'} aria-pressed={armed} aria-label="Pick entry on chart" disabled={pending} onClick={()=>{if(armed)cancelPick();else{cancelPick();setArmed(true)}}}><Crosshair/></Button>
          {(['long','short'] as const).map(d=><Button key={d} className="h-9 px-2" size="sm" variant={hypothesis.direction===d?'default':'outline'} aria-pressed={hypothesis.direction===d} disabled={pending} onClick={()=>{cancelPick();setHypothesis(h=>h?changeEntryDirection(h,d):h)}}>{d==='long'?'Long':'Short'}</Button>)}
        </div>
        {manual!==null?<div className="mt-1 flex items-center gap-1"><span className="flex-1 text-xs text-muted-foreground">{manualError?'Invalid price':'Set a draft price'}</span><Button className="h-9" size="sm" onClick={()=>{const n=normalizePrice(Number(manual),data.snapshot.pointSize);if(n===null)setManualError(true);else stage(n,hypothesis.entryTimeframe)}}>Set draft</Button><Button className="h-9" variant="ghost" size="sm" onClick={cancelPick}>Cancel</Button></div>:draft?<div className="mt-1 flex items-center gap-1"><span className="flex-1 text-xs">{draft.timeframe} · Confirm entry</span><Button className="h-9" size="sm" onClick={confirm}>Confirm</Button><Button className="h-9" variant="ghost" size="sm" onClick={cancelPick}>Cancel</Button></div>:armed?<p className="py-1 text-xs text-muted-foreground">Tap either price chart to stage an entry.</p>:null}
        <div className="mt-1 flex gap-1">
          <Button ref={reviewButton} className="h-9 min-w-0 flex-1" disabled={pending||armed||!!draft||manual!==null||hypothesis.entryPrice===null} onClick={()=>openSheet('review')}>Review{options?.options.length?' · '+options.options.length+' options':''}</Button>
          <Button ref={evidenceButton} className="h-9" variant="outline" disabled={pending} onClick={()=>openSheet('evidence')}>Evidence</Button>
          <Button className="h-9" variant="ghost" size="sm" onClick={()=>{cancelPick();setHypothesis(createHypothesis(crypto.randomUUID(),data.snapshot.id,hypothesis.direction))}}>Clear</Button>
        </div>
        {hypothesis.stopLossPrice!==null&&hypothesis.takeProfitPrice!==null&&!draft&&<p className="truncate py-1 font-mono text-[11px] text-muted-foreground">Preview · SL {hypothesis.stopLossPrice.toFixed(5)} · TP {hypothesis.takeProfitPrice.toFixed(5)}</p>}
      </footer>
      <Dialog open={sheet!==null} onOpenChange={open=>{if(!open)setSheet(null)}}>
        <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 flex max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-xl p-0 sm:max-w-none lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-xl"
          onCloseAutoFocus={e=>{e.preventDefault();(returnFocus.current==='review'?reviewButton:evidenceButton).current?.focus()}}>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
            <div><DialogTitle>{sheet==='review'?'Trade review':'Numerical evidence'}</DialogTitle><DialogDescription className="mt-1 text-xs">{hypothesis.direction.toUpperCase()} · {hypothesis.entryPrice?.toFixed(5)??'No entry'} · frozen snapshot</DialogDescription></div>
            <Button variant="ghost" className="size-9" size="icon" aria-label="Close review sheet" onClick={()=>setSheet(null)}><X/></Button>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            {sheet==='review'?<>
              {options&&<TradeOptionsPanel result={options} onSelect={o=>{
                setHypothesis(h=>h&&h.id===options.hypothesisId&&h.revision===options.revision&&h.snapshotId===options.snapshotId?{...h,stopLossPrice:o.stopLossPrice,takeProfitPrice:o.takeProfitPrice,revision:h.revision+1}:h)
                setSheet(null)
              }}/>}
              {review&&<details><summary className="cursor-pointer p-3 text-sm font-medium">Detailed assessment</summary><TradeReviewPanel review={review}/></details>}
            </>:<>
              <div className="p-3 text-xs text-muted-foreground">Policy {data.report.policy.version} · indicators {data.report.configVersion}</div>
              {data.report.results.map(r=><EvidenceInspector key={r.timeframe+':'+r.toolId} result={r}/>)}
              <div className="p-3 text-xs text-muted-foreground">{data.report.limitations.map((l,i)=><p key={i}>{l}</p>)}</div>
            </>}
          </div>
        </DialogContent>
      </Dialog>
    </>}
  </div>
}
