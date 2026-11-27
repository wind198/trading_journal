'use client'

import { Button } from '@/components/ui/button'
import type { TradeOptions, TradeOption } from '@/lib/trade-evaluation/options'

const messages:Record<TradeOptions['status'],string>={
  entry_required:'Select entry and direction on the chart.',
  context_unresolved:'Market context is unresolved; structural options withheld.',
  no_structural_pair:'No supported SL/TP reference pair found in a coherent strategy and timeframe.',
  no_feasible_option:'No evaluated structural combination satisfies the risk policy and available evidence.',
  options_available:'Structural alternatives, not ranked recommendations.',
}
export function TradeOptionsPanel({result,onSelect}:{result:TradeOptions;onSelect:(option:TradeOption)=>void}){
 return <section className="space-y-2 border-b p-3">
   <h2 className="text-sm font-semibold">SL / TP options</h2>
   <p className="text-xs text-muted-foreground">{messages[result.status]}</p>
   {result.entryReview.warnings.filter(w=>w.dimension==='entry'||w.dimension==='data').map((w,i)=><p key={w.code+':'+i} className="text-xs text-muted-foreground">{w.timeframe??'Context'} · {w.message}</p>)}
   {result.options.map(o=><article key={o.id} className="space-y-2 rounded-md border p-2 text-xs">
     <h3 className="font-medium">{o.stopReference.timeframe} · {o.stopReference.source}</h3>
     <p className="text-muted-foreground">Target: {o.targetReference.source}</p>
     <dl className="grid grid-cols-3 gap-1 font-mono">
       <div><dt>SL</dt><dd>{o.stopLossPrice.toFixed(5)}</dd><dd>{o.riskPoints} pts</dd></div>
       <div><dt>TP</dt><dd>{o.takeProfitPrice.toFixed(5)}</dd><dd>{o.rewardPoints} pts</dd></div>
       <div><dt>Gross R:R</dt><dd>1:{o.grossRewardRisk.toFixed(2)}</dd></div>
     </dl>
     {o.review.warnings.map((w,i)=><p key={w.code+':'+i} className="border-l pl-2">{w.timeframe??'Policy'} · {w.message}</p>)}
     <Button variant="outline" size="sm" className="w-full" onClick={()=>onSelect(o)}>Preview SL / TP on charts</Button>
   </article>)}
   <p className="text-xs text-muted-foreground">Experimental references and buffers. Costs and monetary exposure unassessed. Preview does not submit orders or approve a trade.</p>
 </section>
}
