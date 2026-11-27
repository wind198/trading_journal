'use client'

import { useEffect, useRef, useState } from 'react'
import { Play, X, AlertTriangle, ChartNoAxesCombined } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { WorkspaceAnalysis } from '@/lib/market-analysis/workspace'
import type { AnalysisResult } from '@/lib/market-analysis/contracts'
import { AnalysisChart, type AnalysisView } from './analysis-chart'

const views: { id: AnalysisView; label: string }[] = [
  {id:'overview',label:'Overview'}, {id:'trend',label:'Trend'}, {id:'range',label:'Range'},
  {id:'transition',label:'Transition'}, {id:'momentum',label:'Momentum'},
]
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

export function MarketAnalysisWorkspace() {
  const [data,setData] = useState<WorkspaceAnalysis|null>(null)
  const [view,setView] = useState<AnalysisView>('overview')
  const [pending,setPending] = useState(false)
  const [error,setError] = useState<string|null>(null)
  const active = useRef<AbortController|null>(null)
  useEffect(()=>()=>active.current?.abort(),[])
  async function run() {
    if(active.current)return
    const controller = new AbortController()
    active.current=controller
    setPending(true);setError(null)
    try {
      const response = await fetch('/api/market-analysis/scan',{method:'POST',signal:controller.signal,cache:'no-store'})
      if(!response.ok)throw new Error(response.status===401?'Session expired. Sign in again.':'Market scan failed. Retry.')
      const next = await response.json() as WorkspaceAnalysis
      if(!controller.signal.aborted)setData(next)
    } catch (e) {
      if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Market scan failed.')
    } finally {
      if(active.current===controller){active.current=null;setPending(false)}
    }
  }
  function cancel() {
    active.current?.abort();active.current=null;setPending(false)
  }
  return <div className="flex min-h-full min-w-0 flex-col">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-card px-3 py-2">
      <div className="min-w-0"><h1 className="text-sm font-semibold">Market analysis · EURUSD</h1><p className="text-xs text-muted-foreground">On-demand numerical evidence · experimental</p></div>
      <div className="flex gap-2">
        {pending && <Button variant="outline" size="sm" onClick={cancel}><X className="size-4"/>Cancel</Button>}
        <Button size="sm" disabled={pending} onClick={run}><Play className="size-4"/>{pending?'Scanning…':'Run scan'}</Button>
      </div>
    </header>
    <div role="group" aria-label="Analysis view" className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-1">
      {views.map(v=><Button key={v.id} size="sm" variant={view===v.id?'secondary':'ghost'} aria-pressed={view===v.id} onClick={()=>setView(v.id)}>{v.label}</Button>)}
    </div>
    <div aria-live="polite" className="border-b px-3 py-2 text-xs text-muted-foreground">
      {pending ? 'Acquiring completed candles and calculating indicators…' : data ? 'Snapshot '+data.snapshot.asOf+' · alignment '+data.report.alignment : 'No scan yet. Run a scan to inspect the latest completed bars.'}
      {data && pending && <span> Showing previous snapshot {data.snapshot.asOf}.</span>}
    </div>
    {error && <div role="alert" className="flex gap-2 border-b px-3 py-2 text-sm text-destructive"><AlertTriangle className="size-4 shrink-0"/>{error}{data?' Previous snapshot retained.':''}</div>}
    {!data ? <div className="grid min-h-64 flex-1 place-items-center p-6 text-center text-muted-foreground">
      <div><ChartNoAxesCombined className="mx-auto mb-3 size-8"/><p className="text-sm">No analysis available</p><p className="mt-1 text-xs">No automatic scans or trading recommendations.</p></div>
    </div> : <div className="grid min-w-0 flex-1 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid min-w-0 gap-px bg-border md:grid-cols-2 xl:grid-cols-1">
        {(['M15','M3'] as const).map(tf=><section key={tf} className="flex h-[42vh] min-h-60 min-w-0 flex-col bg-card">
          <div className="flex flex-wrap items-center justify-between gap-1 border-b px-3 py-1.5 text-xs">
            <span className="font-medium">{tf} · {data.report.regimes[tf]}</span>
            <span className="text-muted-foreground">{data.snapshot.bars[tf].length} closed bars · UTC close</span>
          </div>
          <p className="px-3 py-1 text-xs text-muted-foreground">{data.report.classifications[tf].reason}</p>
          <AnalysisChart data={data} timeframe={tf} view={view}/>
        </section>)}
      </div>
      <aside className="min-w-0 border-t bg-card xl:border-l xl:border-t-0">
        <div className="border-b p-3"><h2 className="text-sm font-semibold">Evidence inspector</h2><p className="text-xs text-muted-foreground">Policy {data.report.policy.version} · indicator config {data.report.configVersion}</p></div>
        {data.report.results.map(r=><EvidenceInspector key={r.timeframe+':'+r.toolId} result={r}/>)}
        <div className="space-y-1 p-3 text-xs text-muted-foreground"><h2 className="font-medium text-foreground">Limitations</h2>{data.report.limitations.map((l,i)=><p key={i}>{l}</p>)}<p>AI risk review is not integrated. No warning does not mean safe to trade.</p></div>
      </aside>
    </div>}
  </div>
}
