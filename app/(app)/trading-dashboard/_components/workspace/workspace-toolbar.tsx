'use client'

import { AppMenu } from '@/app/(app)/_components/app-shell/app-menu'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { type ChartType } from '../chart/price-chart'
import { Camera, ChartCandlestick, ChartNoAxesCombined, Expand, PanelRight, RefreshCw, RotateCcw, Shrink } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { LayoutSizeControls } from './layout-size-controls'
import type { LayoutPreferences } from '../../_lib/workspace/layout-preferences'
import type { FavoriteTools } from '../../_lib/workspace/favorite-tools'
import { DrawingToolMenu } from './drawing-tool-menu'
import type { DrawingControl, DrawingMode } from '../../_lib/workspace/drawing-control'
import { CHART_TYPES, SYMBOL, type PaneId } from '../../_lib/workspace/workspace-layout'

export function WorkspaceToolbar({
  onCaptureScreenshot, capturingScreenshot, preferences, onPreferencesChange, wideLayout, fullScreen, expanded, focusMode, marketReloading, globalChartType,
  favorites, onToggleFavorites, onEditFavorites, drawingControl, onDrawingMode, inspectorOpen, onFocusChange, onReloadMarketData, onResetLayout, onChartTypeChange, onToggleInspector, onFullscreen,
}: {
  onCaptureScreenshot: () => void
  capturingScreenshot: boolean
  preferences: LayoutPreferences
  onPreferencesChange: (update: (current: LayoutPreferences) => LayoutPreferences) => void
  wideLayout: boolean
  fullScreen: boolean
  expanded: PaneId | null
  focusMode: boolean
  marketReloading: boolean
  globalChartType: ChartType
  favorites: FavoriteTools
  onToggleFavorites: () => void
  onEditFavorites: () => void
  drawingControl: DrawingControl
  onDrawingMode: (mode: DrawingMode) => void
  inspectorOpen: boolean
  onFocusChange: (value: boolean) => void
  onReloadMarketData: () => void
  onResetLayout: () => void
  onChartTypeChange: (type: ChartType) => void
  onToggleInspector: () => void
  onFullscreen: () => void
}) {
  return (
    <header className="workspace-toolbar flex min-w-0 shrink-0 items-center gap-0 border-b border-border bg-card">
          <div className="workspace-toolbar-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {!fullScreen && <div className="workspace-app-menu hidden shrink-0"><AppMenu /></div>}
          <div className="flex shrink-0 items-center gap-1 text-xs font-medium">
            <span className="workspace-symbol">{SYMBOL}</span>
            <span className="workspace-active-timeframe rounded bg-primary/10 px-1 py-0.5 text-primary" aria-label={"Active chart " + drawingControl.paneId}>{drawingControl.paneId.toUpperCase()}</span>
            
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
            {expanded == null && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 min-w-9 px-2" aria-label="Chart layout and pane sizes">
                    {focusMode ? '2' : '4'}<span className="hidden lg:inline"> charts</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto min-w-20 max-h-[75dvh] overflow-y-auto p-2">
                  <div className="flex gap-1 px-2 pb-1">
                    <Button size="sm" variant={!focusMode ? 'default' : 'outline'} aria-pressed={!focusMode} onClick={() => onFocusChange(false)}>4 charts</Button>
                    <Button size="sm" variant={focusMode ? 'default' : 'outline'} aria-pressed={focusMode} onClick={() => onFocusChange(true)}>2 charts</Button>
                  </div>
                  <LayoutSizeControls preferences={preferences} onChange={onPreferencesChange} wide={wideLayout} />
                </PopoverContent>
              </Popover>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" className="size-9" aria-label="Workspace actions">
                  <RotateCcw aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={marketReloading} onSelect={() => onReloadMarketData()}><RefreshCw />Reload market data</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onResetLayout()}><RotateCcw />Reset layout</DropdownMenuItem>
                {expanded == null && CHART_TYPES.map((type) => (
                  <DropdownMenuItem key={type.id} onSelect={() => onChartTypeChange(type.id)}>
                    {type.id === 'candlestick' ? <ChartCandlestick /> : <ChartNoAxesCombined />}
                    {type.label}{globalChartType === type.id ? ' (active)' : ''}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button type="button" variant="ghost" size="icon-sm" className="size-9 shrink-0" aria-label="Capture screenshot" title="Capture screenshot" disabled={capturingScreenshot} onClick={onCaptureScreenshot}><Camera /></Button>
            <DrawingToolMenu paneId={drawingControl.paneId} mode={drawingControl.mode} onMode={onDrawingMode} favorites={favorites} onToggleFavorites={onToggleFavorites} onEditFavorites={onEditFavorites} />
            <Button
              variant={inspectorOpen ? 'secondary' : 'ghost'}
              size="icon-sm"
              className="size-9"
              aria-label={inspectorOpen ? 'Close inspector' : 'Open inspector'}
              aria-expanded={inspectorOpen}
              aria-controls="workspace-inspector"
              onClick={onToggleInspector}
            >
              <PanelRight />
            </Button>
            

          </div>
          </div>
          <Button
              variant="ghost"
              size="icon-sm"
              className="workspace-fullscreen-button size-9 shrink-0"
              aria-label={fullScreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={fullScreen ? "Exit fullscreen" : "Enter fullscreen"}
              aria-pressed={fullScreen}
              onClick={() => onFullscreen()}
            >
              {fullScreen ? <Shrink /> : <Expand />}
            </Button>
        </header>
  )
}
