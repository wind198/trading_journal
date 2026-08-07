'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useDateRange } from '@/components/date-range-provider'
import { formatVnDateLong } from '@/lib/date-range'
import { CalendarRange } from 'lucide-react'

const PRESETS = [
  { id: 'today' as const, label: 'Today' },
  { id: 'week' as const, label: 'This week' },
  { id: 'month' as const, label: 'This month' },
]

export function DateRangePicker() {
  const { range, setPreset, setCustomRange } = useDateRange()

  return (
    <>
      {PRESETS.map((preset) => (
        <Button
          key={preset.id}
          type="button"
          size="sm"
          variant={range.preset === preset.id ? 'default' : 'outline'}
          onClick={() => setPreset(preset.id)}
        >
          {preset.label}
        </Button>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant={range.preset === 'custom' ? 'default' : 'outline'}
            aria-label="Custom date range"
            className="sm:gap-1.5"
          >
            <CalendarRange className="size-3.5" />
            <span className="hidden sm:inline">
              {range.preset === 'custom'
                ? `${formatVnDateLong(range.from)} – ${formatVnDateLong(range.to)}`
                : 'Custom'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3 p-3">
          <div className="space-y-1.5">
            <label htmlFor="range-from" className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <Input
              id="range-from"
              type="date"
              value={range.from}
              onChange={(e) => setCustomRange(e.target.value, range.to)}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="range-to" className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <Input
              id="range-to"
              type="date"
              value={range.to}
              onChange={(e) => setCustomRange(range.from, e.target.value)}
              className="h-10"
            />
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
