'use client'

import { Button } from '@/components/ui/button'
import { type ChartType } from '../chart/price-chart'
import { ArrowDown, ArrowUp, ChartCandlestick, ChartNoAxesCombined, Maximize2, Minimize2, Minus, Trash2 } from 'lucide-react'
import { CHART_TYPES, type PaneDefinition } from '../../_lib/workspace/workspace-layout'

type BiasValue = -1 | 0 | 1

function BiasArrow({ value, compact }: { value: BiasValue | null; compact: boolean }) {
  if (value == null) return null
  const size = compact ? 'size-3' : 'size-3.5'
  if (value === 1) {
    return (
      <ArrowUp
        className={`${size} text-success`}
        aria-label="Bullish base-line bias"
      />
    )
  }
  if (value === -1) {
    return (
      <ArrowDown
        className={`${size} text-destructive`}
        aria-label="Bearish base-line bias"
      />
    )
  }
  return (
    <Minus
      className={`${size} text-muted-foreground`}
      aria-label="Neutral base-line bias"
    />
  )
}

export function ChartPaneHeader({
  pane, compact, isExpanded, chartType, bias, active, onActivate, selectedDrawingId,
  onChartType, deleteSelectedDrawing, onToggleExpand,
}: {
  pane: PaneDefinition
  compact: boolean
  isExpanded: boolean
  chartType: ChartType
  bias: BiasValue | null
  active: boolean
  onActivate: () => void
  selectedDrawingId: string | null
  onChartType: (type: ChartType) => void
  deleteSelectedDrawing: () => void
  onToggleExpand: () => void
}) {
  return (
    <div
        data-pane-header
        className={
          compact
            ? 'workspace-pane-overlay pointer-events-none absolute inset-x-0.5 top-0.5 z-20 flex items-start justify-between'
            : 'relative z-20 flex min-w-0 shrink-0 items-center gap-1 border-b border-border px-1'
        }
      >
        <button type="button" aria-label={'Activate ' + pane.label + ' chart'} aria-pressed={active} onClick={onActivate}
          className={
            compact
              ? 'workspace-pane-label pointer-events-auto flex min-h-6 items-center gap-1 rounded bg-background/90 px-1 text-[11px] font-medium'
              : 'flex shrink-0 items-center gap-1 text-xs font-medium'
          }
        >
          {compact ? pane.label.toUpperCase() : `EURUSD ${pane.label}`}
          <BiasArrow value={bias} compact={compact} />
        </button>
        <div
          className={
            compact
              ? 'pointer-events-auto flex items-center'
              : 'flex min-w-0 flex-1 items-center justify-start gap-0.5'
          }
        >
          <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {isExpanded &&
            CHART_TYPES.map((type) => (
              <Button
                key={type.id}
                size="sm"
                variant={chartType === type.id ? 'default' : 'outline'}
                onClick={() => onChartType(type.id)}
              >
                {type.id === 'candlestick' ? <ChartCandlestick /> : <ChartNoAxesCombined />}
                {type.label}
              </Button>
            ))}
          {selectedDrawingId && (
            <Button variant="destructive" size="icon-sm" aria-label="Delete selected drawing" onClick={deleteSelectedDrawing}><Trash2 /></Button>
          )}
          </div>
          <Button
            variant="ghost"
            size={compact ? 'icon-sm' : 'icon'}
            type="button"
            className={compact ? 'workspace-pane-expand pointer-events-auto size-9 shrink-0 touch-manipulation bg-background/90' : 'workspace-pane-expand size-9 shrink-0 touch-manipulation ml-auto bg-background'}
            aria-label={isExpanded ? 'Collapse window' : 'Expand window'}
            onClick={(event) => { event.stopPropagation(); onToggleExpand() }}
          >
            {isExpanded ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      </div>
  )
}
