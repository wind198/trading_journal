'use client'

import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { type ChartType, type DrawTool } from '../chart/price-chart'
import { type ChartDrawingKind } from '../../_lib/chart/chart-drawings'
import { CHART_ICON_DEFINITIONS, type ChartIconKind } from '../../_lib/chart/chart-icons'
import { ArrowDown, ArrowUp, ChartCandlestick, ChartNoAxesCombined, Expand, Maximize2, Minimize2, Minus, Ruler, MapPin, Spline, Circle, Square, Trash2, TrendingUp, Type } from 'lucide-react'
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
  pane, compact, isExpanded, chartType, bias, measureActive, drawTool, iconToolActive, selectedDrawingId,
  onChartType, toggleMeasure, toggleTool, selectIconTool, onClearTool, deleteSelectedDrawing, onToggleExpand,
}: {
  pane: PaneDefinition
  compact: boolean
  isExpanded: boolean
  chartType: ChartType
  bias: BiasValue | null
  measureActive: boolean
  drawTool: DrawTool
  iconToolActive: boolean
  selectedDrawingId: string | null
  onChartType: (type: ChartType) => void
  toggleMeasure: () => void
  toggleTool: (tool: ChartDrawingKind) => void
  selectIconTool: (kind: ChartIconKind) => void
  onClearTool: () => void
  deleteSelectedDrawing: () => void
  onToggleExpand: () => void
}) {
  return (
    <div
        className={
          compact
            ? 'pointer-events-none absolute inset-x-0.5 top-0.5 z-10 flex items-start justify-between'
            : 'flex min-w-0 shrink-0 items-center gap-1 border-b border-border px-1'
        }
      >
        <h2
          className={
            compact
              ? 'pointer-events-none flex items-center gap-1 rounded bg-background/80 px-1 py-0.5 text-[11px] font-medium'
              : 'flex shrink-0 items-center gap-1 text-xs font-medium'
          }
        >
          {compact ? pane.label.toUpperCase() : `EURUSD ${pane.label}`}
          <BiasArrow value={bias} compact={compact} />
        </h2>
        <div
          className={
            compact
              ? 'pointer-events-auto flex items-center'
              : 'flex min-w-0 flex-1 items-center justify-start gap-0.5 overflow-x-auto'
          }
        >
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
          {isExpanded && (
            <>
              <Button
                variant={measureActive ? 'default' : 'ghost'}
                size="icon"
                aria-label={measureActive ? 'Cancel price measurement' : 'Measure price distance'}
                aria-pressed={measureActive}
                onClick={toggleMeasure}
              >
                <Ruler />
              </Button>
              <Button
                variant={drawTool === 'trendline' ? 'default' : 'ghost'}
                size="icon"
                aria-label={drawTool === 'trendline' ? 'Cancel trendline' : 'Draw trendline'}
                aria-pressed={drawTool === 'trendline'}
                onClick={() => toggleTool('trendline')}
              >
                <TrendingUp />
              </Button>
              <Button
                variant={drawTool === 'rectangle' ? 'default' : 'ghost'}
                size="icon"
                aria-label={drawTool === 'rectangle' ? 'Cancel rectangle' : 'Draw rectangle'}
                aria-pressed={drawTool === 'rectangle'}
                onClick={() => toggleTool('rectangle')}
              >
                <Square />
              </Button>
              <Button
                variant={drawTool === 'fibonacci_range' ? 'default' : 'ghost'}
                size="icon"
                aria-label={drawTool === 'fibonacci_range' ? 'Cancel Fibonacci Range' : 'Draw Fibonacci Range'}
                aria-pressed={drawTool === 'fibonacci_range'}
                onClick={() => toggleTool('fibonacci_range')}
              >
                <span className="text-xs font-semibold">Fib</span>
              </Button>
              <Button
                variant={drawTool === 'fibonacci_range_extension' ? 'default' : 'ghost'}
                size="icon"
                aria-label={drawTool === 'fibonacci_range_extension' ? 'Cancel Fibonacci Range Extension' : 'Draw Fibonacci Range Extension'}
                aria-pressed={drawTool === 'fibonacci_range_extension'}
                onClick={() => toggleTool('fibonacci_range_extension')}
              >
                <span className="text-xs font-semibold">Ext</span>
              </Button>
              <Button
                variant={drawTool === 'warning_circle' ? 'default' : 'ghost'}
                size="icon"
                aria-label={
                  drawTool === 'warning_circle' ? 'Cancel warning circle' : 'Draw warning circle'
                }
                aria-pressed={drawTool === 'warning_circle'}
                onClick={() => toggleTool('warning_circle')}
              >
                <Circle />
              </Button>
              <Button
                variant={drawTool === 'polyline_arrow' ? 'default' : 'ghost'}
                size="icon"
                aria-label={
                  drawTool === 'polyline_arrow' ? 'Cancel polyline arrow' : 'Draw polyline arrow'
                }
                aria-pressed={drawTool === 'polyline_arrow'}
                onClick={() => toggleTool('polyline_arrow')}
              >
                <Spline />
              </Button>
              <Button
                variant={drawTool === 'text_anchor' ? 'default' : 'ghost'}
                size="icon"
                aria-label={drawTool === 'text_anchor' ? 'Cancel text anchor' : 'Place text anchor'}
                aria-pressed={drawTool === 'text_anchor'}
                onClick={() => toggleTool('text_anchor')}
              >
                <Type />
              </Button>
              {drawTool === 'polyline_arrow' && (
                <span className="text-xs text-muted-foreground">
                  Tap points · double-tap final point
                </span>
              )}
              {drawTool === 'text_anchor' && (
                <span className="text-xs text-muted-foreground">Tap to place text</span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={iconToolActive ? 'default' : 'ghost'}
                    size="icon"
                    aria-label={iconToolActive ? 'Cancel icon placement' : 'Place chart icon'}
                    aria-pressed={iconToolActive}
                  >
                    <MapPin />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Icons</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {CHART_ICON_DEFINITIONS.map((def) => (
                    <DropdownMenuItem
                      key={def.kind}
                      onClick={() => selectIconTool(def.kind)}
                      className={drawTool === def.kind ? 'bg-accent' : undefined}
                    >
                      {def.label}
                    </DropdownMenuItem>
                  ))}
                  {iconToolActive && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onClearTool}>Clear tool</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {selectedDrawingId && (
                <Button
                  variant="destructive"
                  size="icon"
                  aria-label="Delete selected drawing"
                  onClick={deleteSelectedDrawing}
                >
                  <Trash2 />
                </Button>
              )}
            </>
          )}
          <Button
            variant="ghost"
            size={compact ? 'icon-sm' : 'icon'}
            className={compact ? 'size-8 bg-background/80' : 'sticky right-0 ml-auto bg-background'}
            aria-label={isExpanded ? 'Collapse window' : 'Expand window'}
            onClick={onToggleExpand}
          >
            {isExpanded ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </div>
      </div>
  )
}
