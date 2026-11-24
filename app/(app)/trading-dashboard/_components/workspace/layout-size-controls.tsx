'use client'
import { Slider } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { DEFAULT_LAYOUT, resizePortrait, type LayoutPreferences } from '../../_lib/workspace/layout-preferences'

function SizeSlider({ label, value, min = 25, max = 75, onChange }: {
  label: string; value: number; min?: number; max?: number; onChange: (value: number) => void
}) {
  return (
    <div className="grid gap-1 px-2 py-1">
      <div className="flex justify-between text-xs"><span>{label}</span><span className="tabular-nums">{value}</span></div>
      <Slider.Root className="relative flex h-8 w-full touch-none select-none items-center" value={[value]} min={min} max={max} step={5} onValueChange={([next]) => { if (next != null) onChange(next) }}>
        <Slider.Track className="relative h-1.5 grow rounded-full bg-muted"><Slider.Range className="absolute h-full rounded-full bg-primary" /></Slider.Track>
        <Slider.Thumb aria-label={label} className="block size-5 rounded-full border border-primary bg-background shadow-sm focus-visible:outline-2 focus-visible:outline-ring" />
      </Slider.Root>
    </div>
  )
}

export function LayoutSizeControls({ preferences, onChange, wide }: {
  preferences: LayoutPreferences
  onChange: (update: (current: LayoutPreferences) => LayoutPreferences) => void
  wide: boolean
}) {
  const { focusMode } = preferences
  return (
    <div className="w-64 max-w-[80vw]">
      {focusMode ? (
        <SizeSlider label={wide ? 'M15 width (%)' : 'M15 height (%)'} value={wide ? preferences.focusWide : preferences.focusPortrait}
          onChange={value => onChange(current => ({ ...current, [wide ? 'focusWide' : 'focusPortrait']: value }))} />
      ) : wide ? (
        <>
          <SizeSlider label="Top row height (%)" value={preferences.fourWide.row} onChange={row => onChange(current => ({ ...current, fourWide: { ...current.fourWide, row } }))} />
          <SizeSlider label="Left column width (%)" value={preferences.fourWide.column} onChange={column => onChange(current => ({ ...current, fourWide: { ...current.fourWide, column } }))} />
        </>
      ) : (
        ['H4', 'H1', 'M15', 'M3'].map((label, index) => (
          <SizeSlider key={label} label={label + ' relative height'} min={15} max={85} value={preferences.fourPortrait[index]!}
            onChange={value => onChange(current => ({ ...current, fourPortrait: resizePortrait(current.fourPortrait, index, value) }))} />
        ))
      )}
      <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => onChange(current => ({ ...DEFAULT_LAYOUT, focusMode: current.focusMode }))}>Equal pane sizes</Button>
    </div>
  )
}
