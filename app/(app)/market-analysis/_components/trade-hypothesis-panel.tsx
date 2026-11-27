'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Crosshair, X } from 'lucide-react'
import type { TradeDirection, TradeHypothesis, TradeLevel } from '@/lib/trade-evaluation/contracts'
import { evaluateGeometry } from '@/lib/trade-evaluation/hypothesis'
import { useState } from 'react'

const fields: {key:TradeLevel; label:string}[] = [
  {key:'entryPrice',label:'Entry'}, {key:'stopLossPrice',label:'Stop loss'}, {key:'takeProfitPrice',label:'Take profit'},
]
function PriceField({value,label,onCommit}:{value:number|null;label:string;onCommit:(v:number|null)=>void}) {
  const [draft,setDraft]=useState<string|null>(null)
  const [invalid,setInvalid]=useState(false)
  function commit() {
    if(draft===null)return
    const v=draft.trim()===''?null:Number(draft)
    if(v!==null&&(!Number.isFinite(v)||v<=0)){setInvalid(true);return}
    onCommit(v);setDraft(null);setInvalid(false)
  }
  return <Input aria-label={label+' price'} aria-invalid={invalid} inputMode="decimal" placeholder="Not set"
    value={draft??(value===null?'':value.toFixed(5))}
    onChange={e=>{setDraft(e.target.value);setInvalid(false)}}
    onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit()}if(e.key==='Escape'){setDraft(null);setInvalid(false);e.stopPropagation()}}}
    className="font-mono text-xs"/>
}
export function TradeHypothesisPanel({hypothesis,pointSize,armedLevel,onArm,onPrice,onDirection,onClear}:{
  hypothesis:TradeHypothesis;pointSize:number;armedLevel:TradeLevel|null
  onArm:(v:TradeLevel|null)=>void;onPrice:(level:TradeLevel,value:number|null)=>void
  onDirection:(v:TradeDirection)=>void;onClear:()=>void
}) {
  const geometry=evaluateGeometry(hypothesis,pointSize)
  return <section className="space-y-3 border-b p-3">
    <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Trade hypothesis</h2><Button variant="ghost" size="sm" onClick={onClear}>Clear</Button></div>
    <div role="group" aria-label="Trade direction" className="grid grid-cols-2 gap-1">
      {(['long','short'] as const).map(d=><Button key={d} size="sm" variant={hypothesis.direction===d?'default':'outline'} aria-pressed={hypothesis.direction===d} onClick={()=>onDirection(d)}>{d==='long'?'Long':'Short'}</Button>)}
    </div>
    <div className="space-y-2">
      {fields.map(f=><div key={f.key}>
        <label className="mb-1 block text-xs font-medium">{f.label}</label>
        <div className="flex gap-1">
          <PriceField key={f.key+':'+hypothesis.id+':'+hypothesis[f.key]} label={f.label} value={hypothesis[f.key]} onCommit={v=>onPrice(f.key,v)}/>
          <Button size="sm" variant={armedLevel===f.key?'default':'outline'} aria-label={'Pick '+f.label+' on chart'} aria-pressed={armedLevel===f.key} title={'Pick '+f.label+' on chart'} onClick={()=>onArm(armedLevel===f.key?null:f.key)}><Crosshair className="size-4"/></Button>
          <Button size="sm" variant="ghost" disabled={hypothesis[f.key]===null} aria-label={'Clear '+f.label} onClick={()=>onPrice(f.key,null)}><X className="size-4"/></Button>
        </div>
      </div>)}
    </div>
    <p aria-live="polite" className="text-xs text-muted-foreground">{armedLevel?'Click or tap the price pane on either chart to place '+fields.find(f=>f.key===armedLevel)?.label+'. Escape cancels.':'Use the crosshair buttons to select or move levels. Chart navigation is unaffected when no picker is armed.'}</p>
    <dl className="grid grid-cols-3 gap-1 rounded-md bg-muted p-2 text-xs">
      <div><dt>Risk (pts)</dt><dd className="font-mono font-semibold">{geometry.riskPoints??'—'}</dd></div>
      <div><dt>Reward (pts)</dt><dd className="font-mono font-semibold">{geometry.rewardPoints??'—'}</dd></div>
      <div><dt>Gross R:R</dt><dd className="font-mono font-semibold">{geometry.grossRewardRisk===null?'—':'1:'+geometry.grossRewardRisk.toFixed(2)}</dd></div>
    </dl>
    {geometry.errors.map(e=><p role="alert" key={e} className="text-xs text-destructive">{e}</p>)}
    <p className="text-xs text-muted-foreground">Entry timeframe {hypothesis.entryTimeframe} · Revision {hypothesis.revision} · {geometry.mode}. Gross geometry only; costs, SL/TP suitability and AI risk review not evaluated. No orders are submitted.</p>
  </section>
}
