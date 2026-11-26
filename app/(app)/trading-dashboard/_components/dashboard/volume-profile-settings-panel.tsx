'use client'
import {useState,useEffect} from 'react'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {VP_BIN_COUNTS,MIN_VP_LOOKBACK,MAX_VP_LOOKBACK,type VolumeProfileSettings} from '../../_lib/chart/volume-profile-settings'
export function VolumeProfileSettingsPanel({pane,value,onChange}:{pane:'3m'|'15m';value:VolumeProfileSettings;onChange:(v:VolumeProfileSettings)=>void}){
 const [draft,setDraft]=useState(String(value.lookback))
 useEffect(()=>setDraft(String(value.lookback)),[value.lookback])
 const count=Number(draft),valid=Number.isInteger(count)&&count>=MIN_VP_LOOKBACK&&count<=MAX_VP_LOOKBACK
 return <div className="space-y-2 rounded-md border p-2 text-xs">
  <div className="font-medium">{pane.toUpperCase()} volume profile</div>
  <label className="flex items-center justify-between gap-2"><span>Lookback bars</span><Input type="number" inputMode="numeric" min={MIN_VP_LOOKBACK} max={MAX_VP_LOOKBACK} step={1} aria-label={pane+' volume profile lookback'} value={draft} onChange={e=>setDraft(e.target.value)} className="h-9 w-24 text-base"/></label>
  <Button type="button" size="sm" variant="outline" disabled={!valid||count===value.lookback} onClick={()=>onChange({...value,lookback:count})}>Apply lookback</Button>
  {!valid&&<p role="alert">Enter 1–1000 bars.</p>}
  <div className="flex items-center justify-between gap-1"><span>Price bins</span><div className="flex gap-1">{VP_BIN_COUNTS.map(b=><Button key={b} type="button" size="sm" variant={value.bins===b?'default':'outline'} aria-label={pane+' '+b+' price bins'} aria-pressed={value.bins===b} onClick={()=>onChange({...value,bins:b})}>{b}</Button>)}</div></div>
 </div>
}
