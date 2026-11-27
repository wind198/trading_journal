'use client'

import { useCallback, useEffect, useMemo,useRef, useState } from 'react'
import { Play, X, AlertTriangle, ChartNoAxesCombined, Crosshair, Maximize2, Minimize2, History, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import type { WorkspaceAnalysis } from '@/lib/market-analysis/workspace'
import type { TradeHypothesis } from '@/lib/trade-evaluation/contracts'
import type { AnalysisResult, Timeframe } from '@/lib/market-analysis/contracts'
import { createHypothesis, normalizePrice } from '@/lib/trade-evaluation/hypothesis'
import { confirmEntry, changeEntryDirection, type EntryDraft } from '@/lib/trade-evaluation/entry-selection'
import { localDateTimeInput, m15CloseFromLocalInput } from '@/lib/market-analysis/scan-cutoff'
import type { SearchProgress, TradeOptions } from '@/lib/trade-evaluation/options'
import type { SearchMessage,SearchRequest } from '@/lib/trade-evaluation/search.worker'
import type { TradeReview } from '@/lib/trade-evaluation/evaluator'
import {plottedSetups} from '@/lib/trade-evaluation/overlay-layout'
import { TradeOptionsPanel } from './trade-options-panel'
import { TradeReviewPanel } from './trade-review-panel'
import type { ScaleId } from '@/lib/market-analysis/scales'
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
  const [profiles,setProfiles]=useState<Record<Timeframe,ScaleId>>({M3:'baseline',M15:'baseline'})
  const [view,setView]=useState<AnalysisView>('price')
  const [showReferences,setShowReferences]=useState(false)
  const [showPassed,setShowPassed]=useState(true)
  const [showFailed,setShowFailed]=useState(true)
  const [reviewSetup,setReviewSetup]=useState<string|null>(null)
  const [pending,setPending]=useState(true)
  const [historicalAsOf,setHistoricalAsOf]=useState<string|null>(null)
  const [historyPicking,setHistoryPicking]=useState(false)
  const [historyInput,setHistoryInput]=useState('')
  const [historyOpen,setHistoryOpen]=useState(false)
  const [error,setError]=useState<string|null>(null)
  const [armed,setArmed]=useState(false)
  const [draft,setDraft]=useState<EntryDraft|null>(null)
  const [expanded,setExpanded]=useState<Timeframe|null>(null)
  const [sheet,setSheet]=useState<'review'|'evidence'|null>(null)
  const [manual,setManual]=useState<string|null>(null)
  const [manualError,setManualError]=useState(false)
  const [submitted,setSubmitted]=useState<TradeOptions|null>(null)
  const [previewReview,setPreviewReview]=useState<TradeReview|null>(null)
  const midpointReaders=useRef<Partial<Record<Timeframe,()=>number|null>>>({})
  const registerMidpoint=useCallback((tf:Timeframe,reader:(()=>number|null)|null)=>{
    if(reader)midpointReaders.current[tf]=reader
    else delete midpointReaders.current[tf]
  },[])
  const active=useRef<AbortController|null>(null)
  const searchWorker=useRef<Worker|null>(null)
  const [searching,setSearching]=useState(false)
  const [progress,setProgress]=useState<SearchProgress|null>(null)
  const [searchError,setSearchError]=useState<string|null>(null)
  const cancelSearch=useCallback(()=>{searchWorker.current?.terminate();searchWorker.current=null;setSearching(false);setProgress(null)},[])
  useEffect(()=>()=>{searchWorker.current?.terminate();searchWorker.current=null},[])
  const reviewButton=useRef<HTMLButtonElement>(null)
  const evidenceButton=useRef<HTMLButtonElement>(null)
  const returnFocus=useRef<'review'|'evidence'>('review')
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setHistoryPicking(false);setHistoryOpen(false);setArmed(false);setDraft(null);setManual(null);setManualError(false)}}
    window.addEventListener('keydown',key)
    return()=>window.removeEventListener('keydown',key)
  },[])
  const cancelPick=useCallback(()=>{setArmed(false);setDraft(null);setManual(null);setManualError(false)},[])
  const run=useCallback(async(asOf:string|null=null)=>{
    if(active.current)return
    cancelSearch();setSearchError(null)
    const controller=new AbortController()
    active.current=controller;setPending(true);setError(null);cancelPick();setHistoryPicking(false);setHistoryOpen(false);setSheet(null)
    try{
      const response=await fetch('/api/market-analysis/scan',{method:'POST',signal:controller.signal,cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(asOf?{asOf}:{})})
      if(!response.ok)throw new Error(response.status===401?'Session expired. Sign in again.':'Market scan failed. Retry.')
      const next=await response.json() as WorkspaceAnalysis
      if(!controller.signal.aborted){
        setData(next);setHistoricalAsOf(asOf);setSubmitted(null);setPreviewReview(null)
        setHypothesis(old=>createHypothesis(crypto.randomUUID(),next.snapshot.id,old?.direction??'long'))
      }
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Market scan failed.')}
    finally{if(active.current===controller){active.current=null;setPending(false)}}
  },[cancelPick,cancelSearch])
  // Reset the controller on cleanup so React Strict Mode's second setup can scan.
  useEffect(()=>{void run();return()=>{const controller=active.current;active.current=null;controller?.abort()}},[run])
  function chooseHistory(closeTime:string){if(!pending)void run(closeTime)}
  function openHistory(){
    cancelPick();setHistoryPicking(false)
    setHistoryInput(localDateTimeInput(Date.parse(historicalAsOf??data?.snapshot.asOf??new Date().toISOString())))
    setHistoryOpen(v=>!v)
  }
  function cancel(){active.current?.abort();active.current=null;setPending(false)}
  const options=submitted&&hypothesis&&submitted.snapshotId===hypothesis.snapshotId&&submitted.hypothesisId===hypothesis.id?submitted:null
  const review=previewReview??options?.entryReview??null
  const overlays=useMemo(()=>{const all=data&&options?plottedSetups(data,options):[];const visible=all.filter(s=>s.failed?showFailed:showPassed);return {M3:visible.filter(s=>s.timeframe==='M3'),M15:visible.filter(s=>s.timeframe==='M15')}},[data,options,showPassed,showFailed])
  const reviewFromChart=(id:string)=>{setReviewSetup(id);openSheet('review')}
  function invalidateReview(){setReviewSetup(null);cancelSearch();setSearchError(null);setSubmitted(null);setPreviewReview(null)}
  function beginPick(){
    if(!data||!hypothesis||pending)return
    setHistoryPicking(false);setHistoryOpen(false)
    const tf=expanded??'M3'
    const price=midpointReaders.current[tf]?.()??null
    if(price===null){setManualError(true);return}
    stage(price,tf);setArmed(true)
  }
  function stage(price:number,timeframe:Timeframe){
    if(!data||!hypothesis||pending)return
    const snapped=normalizePrice(price,data.snapshot.pointSize)
    if(snapped===null)return
    invalidateReview()
    setDraft({price:snapped,timeframe,snapshotId:hypothesis.snapshotId,hypothesisId:hypothesis.id,revision:hypothesis.revision})
    setManual(null);setManualError(false)
  }
  function submit(){
    if(!data||!hypothesis||pending||searchWorker.current)return
    let next=hypothesis
    if(manual!==null){
      const price=normalizePrice(Number(manual),data.snapshot.pointSize)
      if(price===null){setManualError(true);return}
      next=confirmEntry(hypothesis,{price,timeframe:draft?.timeframe??hypothesis.entryTimeframe,snapshotId:hypothesis.snapshotId,hypothesisId:hypothesis.id,revision:hypothesis.revision},data.snapshot.pointSize)
    }else if(draft)next=confirmEntry(hypothesis,draft,data.snapshot.pointSize)
    if(next.entryPrice===null)return
    // Evaluation is invoked exclusively by this explicit submission.
    setReviewSetup(null);setHypothesis(next);setSubmitted(null);setPreviewReview(null);setProgress(null);setSearchError(null)
    cancelPick();returnFocus.current='review';setSheet('review');setSearching(true)
    try{
      const worker=new Worker(new URL('../../../../lib/trade-evaluation/search.worker.ts',import.meta.url),{type:'module'})
      searchWorker.current=worker
      const finish=()=>{worker.terminate();if(searchWorker.current===worker){searchWorker.current=null;setSearching(false)}}
      worker.onmessage=(event:MessageEvent<SearchMessage>)=>{
        if(searchWorker.current!==worker)return
        const m=event.data
        if(m.type==='progress')setProgress(m.progress)
        else if(m.type==='result'){setSubmitted(m.result);finish()}
        else {setSearchError(m.message);finish()}
      }
      worker.onerror=()=>{if(searchWorker.current===worker){setSearchError('Structural search worker failed. Retry.');finish()}}
      worker.postMessage({data,hypothesis:next} satisfies SearchRequest)
    }catch{cancelSearch();setSearchError('Unable to start structural search. Retry.')}
  }
  function openSheet(which:'review'|'evidence'){cancelPick();returnFocus.current=which;setSheet(which)}
  const ready=!!data&&!!hypothesis
  return <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
    <header className="flex shrink-0 items-center justify-between gap-1 border-b bg-card px-2 py-1">
      <h1 className="truncate text-sm font-semibold">EURUSD · Analysis</h1>
      <div className="flex shrink-0 gap-1">
        {pending?<Button className="h-9" size="sm" variant="outline" onClick={cancel}><X/>Cancel</Button>:<Button className="h-9" size="sm" onClick={()=>void run(historicalAsOf)}><Play/>{data?'Refresh':'Scan'}</Button>}
      </div>
    </header>
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-card px-2 py-1" role="group" aria-label="Chart indicators">
      <Button className="h-9" size="sm" variant={historyOpen?'secondary':'outline'} disabled={pending} aria-label="Choose historical scan time" onClick={openHistory}><CalendarClock/>History</Button>
      {data&&<Button className="h-9" size="sm" variant={historyPicking?'secondary':'ghost'} aria-pressed={historyPicking} disabled={pending||!data.snapshot.bars.M15.length} onClick={()=>{cancelPick();setHistoryOpen(false);setHistoryPicking(v=>!v);if(expanded==='M3')setExpanded(null)}}><History/>Pick M15</Button>}
      {historicalAsOf&&<Button className="h-9" size="sm" variant="outline" disabled={pending} onClick={()=>void run()}>Latest</Button>}
      {options&&<><Button className="h-9" size="sm" variant={showPassed?'secondary':'ghost'} aria-pressed={showPassed} onClick={()=>setShowPassed(v=>!v)}>Passed {options.options.length}</Button><Button className="h-9" size="sm" variant={showFailed?'secondary':'ghost'} aria-pressed={showFailed} onClick={()=>setShowFailed(v=>!v)}>Failed {options.failedOptions.length}</Button></>}
      <Button className="h-9" size="sm" variant={showReferences?'secondary':'ghost'} aria-pressed={showReferences} onClick={()=>setShowReferences(v=>!v)}>Refs</Button>
      {views.map(v=><Button className="h-9" key={v.id} size="sm" variant={view===v.id?'secondary':'ghost'} aria-pressed={view===v.id} onClick={()=>setView(v.id)}>{v.label}</Button>)}
    </div>
    {historyOpen&&<form className="flex shrink-0 flex-wrap items-center gap-1 border-b bg-card px-2 py-2" onSubmit={e=>{e.preventDefault();const cutoff=m15CloseFromLocalInput(historyInput);if(cutoff)chooseHistory(cutoff)}}>
      <label htmlFor="history-cutoff" className="w-full text-xs text-muted-foreground">M15 close (local time; rounded down to 15 min)</label>
      <Input id="history-cutoff" type="datetime-local" step={900} required max={localDateTimeInput(Math.floor(Date.now()/900000)*900000)} className="h-9 min-w-0 flex-1" value={historyInput} onChange={e=>setHistoryInput(e.target.value)}/>
      <Button size="sm" className="h-9" type="submit">Scan</Button>
      <Button size="sm" className="h-9" variant="ghost" type="button" onClick={()=>setHistoryOpen(false)}>Cancel</Button>
    </form>}
    {historyPicking&&<div className="flex shrink-0 items-center justify-between gap-1 border-b px-2 text-xs"><span>Tap an M15 candle to scan at its close.</span><Button size="sm" variant="ghost" onClick={()=>setHistoryPicking(false)}>Cancel</Button></div>}
    <div aria-live="polite" className="shrink-0 truncate border-b px-2 py-1 text-[11px] text-muted-foreground" title={data?.snapshot.asOf}>
      {pending?'Scanning…'+(data?' previous snapshot shown':''):data?(historicalAsOf?'Historical · ':'Latest snapshot · ')+data.snapshot.asOf.replace('T',' ').slice(0,19)+' UTC':'No snapshot. Retry scan.'}
    </div>
    {error&&<div role="alert" className="flex shrink-0 gap-1 border-b p-2 text-xs text-destructive"><AlertTriangle className="size-4 shrink-0"/>{error}{data?' Previous snapshot retained.':''}</div>}
    {!ready?<div className="grid min-h-0 flex-1 place-items-center p-4 text-center text-muted-foreground"><div><ChartNoAxesCombined className="mx-auto mb-2 size-8"/><p className="text-sm">{pending?'Scanning completed candles…':'Scan completed candles to choose an entry.'}</p></div></div>:null}
    {data&&hypothesis&&<>
      <div className={'grid min-h-0 min-w-0 flex-1 gap-px bg-border '+(expanded?'grid-cols-1 grid-rows-1':'grid-cols-1 grid-rows-2 landscape:grid-cols-2 landscape:grid-rows-1 md:grid-cols-2 md:grid-rows-1')}>
        {(['M15','M3'] as const).map(tf=><section key={tf} className={'min-h-0 min-w-0 flex-col bg-card '+(expanded&&expanded!==tf?'hidden':'flex')}>
          <div className="flex h-8 shrink-0 items-center gap-1 border-b px-2 text-xs">
            <span className="min-w-0 flex-1 truncate font-medium" title={data.report.classifications[tf].reason}>{tf} · {data.snapshot.bars[tf].length?data.report.regimes[tf]:'No data'}{data.report.classifications[tf].dataQuality!=='usable'&&data.snapshot.bars[tf].length?' · '+data.report.classifications[tf].dataQuality.replaceAll('_',' '):''}</span>
            <select aria-label={tf+' indicator scale'} className="h-7 max-w-24 rounded border bg-card px-1 text-xs" value={profiles[tf]} onChange={e=>setProfiles(old=>({...old,[tf]:e.target.value as ScaleId}))}>
              <option value="baseline">1× Base</option><option value="extended">2× Ext</option><option value="structural">4× Struct</option>
            </select>
            <Button variant="ghost" size="icon-sm" className="size-8" aria-label={(expanded===tf?'Restore both charts':'Expand '+tf)} onClick={()=>setExpanded(expanded===tf?null:tf)}>{expanded===tf?<Minimize2/>:<Maximize2/>}</Button>
          </div>
          <div className="flex shrink-0 gap-2 overflow-x-auto whitespace-nowrap px-2 py-0.5 text-[10px] text-muted-foreground" aria-label={tf+' regime by scale'}>{(['baseline','extended','structural'] as const).map(id=>{const q=id==='baseline'?data.report.classifications[tf]:data.report.scales[tf][id].classification;const quality=id==='baseline'?data.report.classifications[tf].dataQuality:data.report.scales[tf][id].quality;return <span key={id} className={profiles[tf]===id?'font-semibold text-foreground':''}>{id==='baseline'?'1×':id==='extended'?'2×':'4×'} {quality==='usable'?q.regime:quality.replaceAll('_',' ')}</span>})}</div>
          <AnalysisChart data={data} timeframe={tf} setups={overlays[tf]} onReview={reviewFromChart} view={view} profile={profiles[tf]} assessment={review?.assessments.find(a=>a.timeframe===tf)} registerMidpoint={registerMidpoint} historyPicking={historyPicking&&tf==='M15'&&!pending} onHistoryPick={chooseHistory} showReferences={showReferences&&!draft&&manual===null} hypothesis={hypothesis} armedLevel={armed&&!pending?'entryPrice':null} draftPrice={draft?.price} onPick={(level,price,timeframe)=>{if(level==='entryPrice')stage(price,timeframe)}}/>
        </section>)}
      </div>
      <footer className="shrink-0 border-t bg-card px-2 pt-1 pb-[max(4px,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <Input aria-label="Entry price" inputMode="decimal" className="h-9 font-mono text-sm" placeholder="Entry price" aria-invalid={manualError}
              value={manual??(draft?.price??hypothesis.entryPrice)?.toFixed(5)??''}
              onChange={e=>{invalidateReview();setManual(e.target.value);setDraft(null);setManualError(false);setArmed(false)}}
              onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();submit()}}}/>
          </div>
          <Button className="h-9 px-2" variant={armed?'secondary':'outline'} aria-pressed={armed} aria-label="Pick entry on chart" disabled={pending} onClick={()=>{if(armed)cancelPick();else beginPick()}}><Crosshair/></Button>
          {(['long','short'] as const).map(d=><Button key={d} className="h-9 px-2" size="sm" variant={hypothesis.direction===d?'default':'outline'} aria-pressed={hypothesis.direction===d} disabled={pending} onClick={()=>{invalidateReview();setHypothesis(h=>h?changeEntryDirection(h,d):h);if(draft)setDraft({...draft,revision:hypothesis.revision+(hypothesis.direction===d?0:1)})}}>{d==='long'?'Long':'Short'}</Button>)}
        </div>
        {(armed||draft||manual!==null||manualError)&&<div className="mt-1 flex items-center gap-1">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">{manualError?'Invalid price or no visible candles.':armed?'Drag the entry line or tap a new price.':'Edit entry, then submit.'}</p>
          <Button className="h-8" variant="ghost" size="sm" onClick={cancelPick}>Cancel</Button>
        </div>}
        <div className="mt-1 flex gap-1">
          <Button ref={reviewButton} className="h-9 min-w-0 flex-1" disabled={pending||searching||historyPicking||(!draft&&manual===null&&hypothesis.entryPrice===null)} onClick={submit}>{searching?'Searching…':'Submit'}</Button>
          {options&&<Button className="h-9" variant="outline" onClick={()=>openSheet('review')}>Review</Button>}
          <Button ref={evidenceButton} className="h-9" variant="outline" disabled={pending} onClick={()=>openSheet('evidence')}>Evidence</Button>
          <Button className="h-9" variant="ghost" size="sm" onClick={()=>{cancelPick();invalidateReview();setHypothesis(createHypothesis(crypto.randomUUID(),data.snapshot.id,hypothesis.direction))}}>Clear</Button>
        </div>
        {hypothesis.stopLossPrice!==null&&hypothesis.takeProfitPrice!==null&&!draft&&<p className="truncate py-1 font-mono text-[11px] text-muted-foreground">Preview · SL {hypothesis.stopLossPrice.toFixed(5)} · TP {hypothesis.takeProfitPrice.toFixed(5)}</p>}
      </footer>
      <Dialog open={sheet!==null} onOpenChange={open=>{if(!open){cancelSearch();setSheet(null)}}}>
        <DialogContent showCloseButton={false} className="top-auto bottom-0 left-0 flex max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none rounded-t-xl p-0 sm:max-w-none lg:top-1/2 lg:bottom-auto lg:left-1/2 lg:max-w-2xl lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-xl"
          onCloseAutoFocus={e=>{e.preventDefault();(returnFocus.current==='review'?reviewButton:evidenceButton).current?.focus()}}>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
            <div><DialogTitle>{sheet==='review'?'Trade review':'Numerical evidence'}</DialogTitle><DialogDescription className="mt-1 text-xs">{hypothesis.direction.toUpperCase()} · {hypothesis.entryPrice?.toFixed(5)??'No entry'} · {historicalAsOf?'historical':'latest'} snapshot · {data.snapshot.asOf.slice(0,16).replace('T',' ')} UTC</DialogDescription></div>
            <Button variant="ghost" className="size-9" size="icon" aria-label="Close review sheet" onClick={()=>{cancelSearch();setSheet(null)}}><X/></Button>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
            {sheet==='review'?<>
              {searching&&<div className="space-y-2 p-3 text-sm" role="status"><p className="font-medium">Searching structural alternatives</p><p className="text-xs text-muted-foreground">{progress?progress.stage.replaceAll('_',' ')+' · '+progress.found+' / '+progress.target+' found':'Starting search…'}</p><progress className="h-2 w-full accent-primary" max={progress?.target??5} value={progress?.found??0}/><p className="text-xs">{progress?.passed??0} passed · {progress?.failed??0} failed · {progress?.evaluated??0} evaluated · {progress?.elapsedMs??0} ms</p><Button variant="outline" size="sm" onClick={cancelSearch}>Cancel search</Button></div>}
              {searchError&&<p role="alert" className="p-3 text-sm text-destructive">{searchError}</p>}
              {options&&<TradeOptionsPanel key={options.snapshotId+':'+options.hypothesisId+':'+options.revision+':'+reviewSetup} initialId={reviewSetup} result={options} data={data} entry={hypothesis.entryPrice} onSelect={o=>{
                if(!options.options.some(p=>p===o))return
                if(hypothesis.id!==options.hypothesisId||hypothesis.revision!==options.revision||hypothesis.snapshotId!==options.snapshotId)return
                // Preview uses the already evaluated option; do not run evaluation again.
                setHypothesis({...hypothesis,stopLossPrice:o.stopLossPrice,takeProfitPrice:o.takeProfitPrice})
                setPreviewReview(o.review);setSheet(null)
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
