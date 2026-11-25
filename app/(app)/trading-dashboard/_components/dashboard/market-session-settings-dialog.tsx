'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { CHART_TIME_ZONE, SESSION_LINE_SLOTS, defaultSessionOpenTimes, formatSessionOpenTime, parseSessionOpenTime, type SessionOpenTimes, type SessionSlotId } from '../../_lib/chart/chart-timezone'

function toDraft(times: SessionOpenTimes): Record<SessionSlotId,string> {
  return Object.fromEntries(SESSION_LINE_SLOTS.map(s => [s.id, formatSessionOpenTime(times[s.id])])) as Record<SessionSlotId,string>
}
export function MarketSessionSettingsDialog({ times, onSave, disabled, saving, error }: { times: SessionOpenTimes; onSave: (times: SessionOpenTimes) => Promise<boolean>; disabled: boolean; saving: boolean; error: string | null }) {
  const [open,setOpen] = useState(false)
  const [draft,setDraft] = useState(() => toDraft(times))
  const valid = SESSION_LINE_SLOTS.every(slot => parseSessionOpenTime(draft[slot.id]) !== null)
  const changeOpen = (value: boolean) => { if(saving) return; if(value) setDraft(toDraft(times)); setOpen(value) }
  const save = async () => {
    if (!valid || saving) return
    const ok = await onSave(Object.fromEntries(SESSION_LINE_SLOTS.map(slot => [slot.id, parseSessionOpenTime(draft[slot.id])!])) as SessionOpenTimes)
    if(ok) setOpen(false)
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button type="button" variant="outline" size="sm" className="h-9" disabled={disabled}>Edit opening times</Button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader><DialogTitle>Market opening times</DialogTitle>
        <DialogDescription>Times are in {CHART_TIME_ZONE} (24-hour clock). Adjust them when daylight saving or your trading schedule changes.</DialogDescription>
      </DialogHeader>
      <form onSubmit={event => { event.preventDefault(); void save() }} className="space-y-3">
        {SESSION_LINE_SLOTS.map(slot => <label key={slot.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2"><span className="size-3 rounded-full" style={{backgroundColor:slot.color}} />{slot.label}</span>
          <Input type="time" disabled={saving} required step={60} className="h-11 w-36 text-base" aria-label={slot.label+' opening time'} value={draft[slot.id]} onChange={event => setDraft(current => ({...current,[slot.id]:event.target.value}))}/>
        </label>)}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2"><Button type="button" variant="ghost" disabled={saving} onClick={()=>setDraft(toDraft(defaultSessionOpenTimes()))}>Reset defaults</Button><Button type="button" variant="outline" disabled={saving} onClick={()=>setOpen(false)}>Cancel</Button><Button type="submit" disabled={!valid || saving}>{saving ? "Saving…" : "Save"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
