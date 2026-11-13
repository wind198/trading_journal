'use client'

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { PeakDetectionConfig } from '../../_lib/overlays/peak-detection'

function RangeField({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => String(v),
}: {
  id: string
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <span className="font-mono text-xs tabular-nums">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
  )
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border px-2.5 py-2 text-sm"
    >
      <span>{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-primary"
      />
    </label>
  )
}

export function PeakTuningSidebar({
  config,
  onChange,
  onClose,
}: {
  config: PeakDetectionConfig
  onChange: (next: PeakDetectionConfig) => void
  onClose: () => void
}) {
  const patch = (partial: Partial<PeakDetectionConfig>) =>
    onChange({ ...config, ...partial })

  return (
    <aside
      className={cn(
        'absolute inset-y-0 right-0 z-30 flex w-full max-w-sm flex-col border-l border-border bg-background shadow-lg',
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">Peak detection</h2>
          <p className="text-xs text-muted-foreground">15m / 3m · close-based</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        <ToggleRow
          id="peak-enabled"
          label="Enabled"
          checked={config.enabled}
          onChange={(enabled) => patch({ enabled })}
        />
        <ToggleRow
          id="peak-show-peaks"
          label="Show peaks"
          checked={config.showPeaks}
          onChange={(showPeaks) => patch({ showPeaks })}
        />
        <ToggleRow
          id="peak-show-troughs"
          label="Show troughs"
          checked={config.showTroughs}
          onChange={(showTroughs) => patch({ showTroughs })}
        />

        <RangeField
          id="peak-smooth"
          label="Smooth length"
          value={config.smoothLen}
          min={3}
          max={5}
          step={1}
          onChange={(smoothLen) => patch({ smoothLen })}
        />
        <RangeField
          id="peak-pivot"
          label="Pivot bars"
          value={config.pivotBars}
          min={1}
          max={3}
          step={1}
          onChange={(pivotBars) => patch({ pivotBars })}
        />
        <RangeField
          id="peak-group-time"
          label="Group time (bars)"
          value={config.groupTimeBars}
          min={1}
          max={20}
          step={1}
          onChange={(groupTimeBars) => patch({ groupTimeBars })}
        />
        <RangeField
          id="peak-group-price"
          label="Group price ×σ"
          value={config.groupPriceStdMult}
          min={0.1}
          max={3}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(groupPriceStdMult) => patch({ groupPriceStdMult })}
        />
        <RangeField
          id="peak-var-lookback"
          label="Variance lookback"
          value={config.varianceLookback}
          min={5}
          max={60}
          step={1}
          onChange={(varianceLookback) => patch({ varianceLookback })}
        />
      </div>
    </aside>
  )
}
