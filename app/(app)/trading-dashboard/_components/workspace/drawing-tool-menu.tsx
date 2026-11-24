'use client'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Pencil, TrendingUp, Square, Circle, Spline, Type, Ruler, AlignLeft, Check, MousePointer2 } from 'lucide-react'
import { CHART_ICON_DEFINITIONS } from '../../_lib/chart/chart-icons'
import type { ChartDrawingKind } from '../../_lib/chart/chart-drawings'
import type { DrawingMode } from '../../_lib/workspace/drawing-control'
import type { PaneId } from '../../_lib/workspace/workspace-layout'

const TOOLS = [
  { tool: 'trendline', label: 'Trend line', icon: TrendingUp },
  { tool: 'rectangle', label: 'Rectangle', icon: Square },
  { tool: 'fibonacci_range', label: 'Fibonacci range', icon: AlignLeft },
  { tool: 'fibonacci_range_extension', label: 'Fibonacci extension', icon: AlignLeft },
  { tool: 'warning_circle', label: 'Warning circle', icon: Circle },
  { tool: 'polyline_arrow', label: 'Polyline arrow', icon: Spline },
  { tool: 'text_anchor', label: 'Text anchor', icon: Type },
] as const satisfies readonly { tool: ChartDrawingKind; label: string; icon: typeof Pencil }[]

export function DrawingToolMenu({ paneId, mode, onMode, disabled }: {
  paneId: PaneId
  mode: DrawingMode
  onMode: (mode: DrawingMode) => void
  disabled?: boolean
}) {
  const active = mode.kind !== 'idle'
  const label = mode.kind === 'measure' ? 'Measure' : mode.kind === 'draw'
    ? TOOLS.find(t => t.tool === mode.tool)?.label ?? CHART_ICON_DEFINITIONS.find(t => t.kind === mode.tool)?.label ?? 'Marker'
    : 'Drawing tools'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={active ? 'default' : 'ghost'} size="icon-sm" className="size-9" disabled={disabled}
          aria-label={label + ' — ' + paneId.toUpperCase()} title={label + ' — ' + paneId.toUpperCase()}>
          {mode.kind === 'measure' ? <Ruler /> : mode.kind === 'draw' ? (() => { const Icon = TOOLS.find(t => t.tool === mode.tool)?.icon ?? Pencil; return <Icon /> })() : <Pencil />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="workspace-drawing-menu max-h-[min(70dvh,28rem)] overflow-y-auto overscroll-contain">
        <DropdownMenuLabel>Draw on {paneId.toUpperCase()}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onMode({ kind: 'idle' })}><MousePointer2 />Cursor / cancel</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onMode({ kind: 'measure' })}><Ruler />Measure{mode.kind === 'measure' && <Check className="ml-auto" />}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {TOOLS.map(({tool, label, icon: Icon}) => (
          <DropdownMenuItem key={tool} onSelect={() => onMode({ kind: 'draw', tool })}>
            <Icon />{label}{mode.kind === 'draw' && mode.tool === tool && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Markers</DropdownMenuLabel>
        {CHART_ICON_DEFINITIONS.map(({kind, label}) => (
          <DropdownMenuItem key={kind} onSelect={() => onMode({ kind: 'draw', tool: kind })}>
            {label}{mode.kind === 'draw' && mode.tool === kind && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
