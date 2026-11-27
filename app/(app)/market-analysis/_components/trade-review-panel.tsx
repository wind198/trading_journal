'use client'

import type { TradeReview } from '@/lib/trade-evaluation/evaluator'

export function TradeReviewPanel({review}:{review:TradeReview}){
  return <section className="space-y-3 border-b p-3" aria-live="polite">
    <div><h2 className="text-sm font-semibold">Trade risk review</h2>
      <p className={'text-xs font-medium '+(review.state==='BLOCKED'||review.state==='INFEASIBLE'?'text-destructive':'text-muted-foreground')}>{review.state.replaceAll('_',' ')}</p>
      <p className="text-xs text-muted-foreground">Revision {review.revision} · Policy {review.policyVersion} · Experimental market checks</p>
    </div>
    {review.context&&<div className="space-y-2 rounded-md border p-2 text-xs">
      <h3 className="font-medium">Trade context · {review.context.kind.replaceAll('_',' ')}</h3>
      <p>{review.context.reason}</p>
      {[review.context.structural,review.context.execution].map(p=><details key={p.timeframe}>
        <summary className="cursor-pointer">{p.timeframe} · {p.regime} · {p.phase.replaceAll('_',' ')}</summary>
        <p className="text-muted-foreground">{p.reason}</p>
        {Object.entries(p.metrics).map(([k,v])=><div key={k} className="flex justify-between gap-2"><span>{k}</span><span className="font-mono">{v===null?'—':v.toFixed(3)}</span></div>)}
        <p className="text-muted-foreground">Phase policy {p.policyVersion} · {p.from??'—'} — {p.through??'—'}</p>
        {p.evidenceIds.map(id=><p key={id} className="break-all text-muted-foreground">{id}</p>)}
      </details>)}
    </div>}
    {review.hard.minimumTargetPoints!==null&&<p className="text-xs">Minimum TP for selected SL: <strong>{review.hard.minimumTargetPoints} points</strong></p>}
    {review.warnings.map((w,i)=><div key={w.code+':'+w.timeframe+':'+i} className="border-l-2 border-warning pl-2 text-xs">
      <p className={'font-medium '+(w.severity==='block'?'text-destructive':'')}>{w.severity==='block'?'Blocked':w.severity==='unassessed'?'Unassessed':'Warning'} · {w.dimension} {w.timeframe??''}</p>
      <p>{w.message}</p><p className="break-all text-muted-foreground">{w.code}</p>
    </div>)}
    {review.assessments.map(a=><details key={a.timeframe} open className="space-y-2 border-t pt-2 text-xs">
      <summary className="cursor-pointer font-medium">{a.timeframe} · {a.strategy}</summary>
      {a.references.map(r=><div key={r.kind+':'+r.source+':'+r.price} className="flex justify-between gap-2">
        <span>{r.kind==='stop'?'SL':'TP'} reference<br/><span className="text-muted-foreground">{r.source}</span></span>
        <span className="text-right font-mono">{r.price.toFixed(5)}<br/>{r.points.toFixed(1)} pts</span>
      </div>)}
      {a.structure&&<details className="border-t pt-2">
        <summary className="cursor-pointer">Active structural zones · {a.structure.zones.length}</summary>
        <p className="text-muted-foreground">Experimental structure policy {a.structure.policyVersion}</p>
        {a.structure.zones.map(z=><div key={z.side+':'+z.lower+':'+z.upper} className="py-1">
          <p>{z.side} · {z.lower.toFixed(5)}–{z.upper.toFixed(5)} · {z.tests} tests</p>
          <p className="text-muted-foreground">Confirmed through {z.confirmedThrough}</p>
        </div>)}
        {a.structure.correction&&<p>Correction root candidate: {a.structure.correction.root.price.toFixed(5)} · {a.structure.correction.recovered?'recovery threshold met':'recovery unconfirmed'}</p>}
      </details>}
      {!a.references.length&&<p className="text-muted-foreground">No structural reference established.</p>}
      {Object.entries(a.metrics).map(([name,v])=><div key={name} className="flex justify-between gap-2"><span className="break-all">{name}</span><span className="font-mono">{v===null?'—':v.toFixed(3)}</span></div>)}
      {a.limitations.map(l=><p key={l} className="text-muted-foreground">{l}</p>)}
      <details><summary className="cursor-pointer text-muted-foreground">Evidence references</summary>
        {[...new Set(a.references.flatMap(r=>r.evidenceIds).concat(a.warnings.flatMap(w=>w.evidenceIds)))].map(id=><p key={id} className="break-all text-muted-foreground">{id}</p>)}
      </details>
    </details>)}
    {review.limitations.map(l=><p key={l} className="text-xs text-muted-foreground">{l}</p>)}
  </section>
}
