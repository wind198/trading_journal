'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMediaQuery } from 'usehooks-ts'
import { DASHBOARD_NOTES_QUERY_KEY } from '../notes/notes-sidebar'
import { loadDashboardNotes } from '../../_lib/notes/dashboard-notes'
import { NonTradeWarningBanner } from '../dashboard/non-trade-warning-banner'
import { ExecutionOrderDrawer } from '../execution/execution-order-drawer'
import { useChartOverlaySettings, useSessionSlotsEnabled } from '../dashboard/chart-overlay-settings-menu'
import { paneIndicators } from '../../_lib/chart/chart-indicator-pane-settings'
import { useAlertConfig } from '../../_hooks/useAlertConfig'
import { type ChartType } from '../chart/price-chart'
import type { Regime } from '../../_lib/overlays/baseline-indicators'
import { hardReloadMarketQueries } from '../../_lib/market-queries'
import { SYMBOL, type PaneId, visibleWorkspacePanes, workspaceLayoutMode } from '../../_lib/workspace/workspace-layout'
import { WorkspaceToolbar } from './workspace-toolbar'
import { WorkspaceLayout } from './workspace-layout'
import { activatePane, resolveDrawingControl, toggleDrawingMode, cancelPaneMode, IDLE_MODE, type DrawingControl, type DrawingMode } from '../../_lib/workspace/drawing-control'
import { useWorkspaceLayoutPreferences } from '../../_hooks/useWorkspaceLayoutPreferences'
import { WorkspaceInspector } from './workspace-inspector'
import { DEFAULT_INSPECTOR, toggleInspector, showInspector } from '../../_lib/workspace/inspector-state'
import { useFavoriteTools } from '../../_hooks/useFavoriteTools'
import { toggleFavorite } from '../../_lib/workspace/favorite-tools'
import { FloatingFavoriteToolbar } from './floating-favorite-toolbar'
import { FavoriteToolsDialog } from './favorite-tools-dialog'
import { captureWorkspace, saveWorkspaceScreenshot, screenshotFilename } from '../../_lib/workspace/workspace-screenshot'
import { ChartPane } from '../chart-pane/chart-pane'

const SMALL_SCREEN_QUERY = '(min-width: 1600px)'

export function TradingWorkspace() {
  const captureRef = useRef<HTMLDivElement>(null)
  const capturingRef = useRef(false)
  const [capturingScreenshot, setCapturingScreenshot] = useState(false)
  const [favorites, setFavorites] = useFavoriteTools()
  const [editFavorites, setEditFavorites] = useState(false)
  const [drawingControl, setDrawingControl] = useState<DrawingControl>({ paneId: '15m', mode: IDLE_MODE })
  const [expanded, setExpanded] = useState<PaneId | null>(null)
  const [fullScreen, setFullScreen] = useState(false)
  const [preferences, setPreferences] = useWorkspaceLayoutPreferences()
  const focusMode = preferences.focusMode
  const wideLayout = useMediaQuery('(min-width: 768px), (orientation: landscape)', { initializeWithValue: false })
  const [overlaySettings, setOverlaySettings] = useChartOverlaySettings()
  const alertConfig = useAlertConfig()
  const [autoRegimesByPane, setAutoRegimesByPane] = useState<Partial<Record<PaneId, Regime | null>>>({})
  const onPaneRegimeChange = useCallback((paneId: PaneId, regime: Regime | null) => {
    setAutoRegimesByPane((current) =>
      current[paneId] === regime ? current : { ...current, [paneId]: regime },
    )
  }, [])
  const [inspector, setInspector] = useState(DEFAULT_INSPECTOR)
  const didAutoOpenNotesRef = useRef(false)
  const notesQuery = useQuery({
    queryKey: DASHBOARD_NOTES_QUERY_KEY,
    queryFn: loadDashboardNotes,
  })
  useEffect(() => {
    if (didAutoOpenNotesRef.current) return
    if (!notesQuery.isSuccess) return
    if (!notesQuery.data.some((note) => note.pinned)) return
    didAutoOpenNotesRef.current = true
    if (!window.matchMedia("(max-width: 767px), (max-height: 500px)").matches) setInspector(current => showInspector(current, 'notes'))
  }, [notesQuery.isSuccess, notesQuery.data])
  const [executionOpen, setExecutionOpen] = useState(false)
  const [marketReloading, setMarketReloading] = useState(false)
  const [resetLayoutEpoch, setResetLayoutEpoch] = useState(0)
  const [appliedResetLayoutEpochs, setAppliedResetLayoutEpochs] = useState<
    Partial<Record<PaneId, number>>
  >({})
  const tablet = useMediaQuery(SMALL_SCREEN_QUERY, { initializeWithValue: false })
  const [chartTypes, setChartTypes] = useState<Partial<Record<PaneId, ChartType>>>({})
  const [globalChartType, setGlobalChartType] = useState<ChartType>('candlestick')
  const queryClient = useQueryClient()
  const visiblePanes = visibleWorkspacePanes(expanded, focusMode)
  const control = resolveDrawingControl(drawingControl, visiblePanes.map(p => p.id))
  const selectPane = (paneId: PaneId) => setDrawingControl(current => activatePane(current, paneId))
  const chooseMode = (mode: DrawingMode) => setDrawingControl(current =>
    toggleDrawingMode(resolveDrawingControl(current, visiblePanes.map(p => p.id)), mode))
  const changeFocus = (focus: boolean) => {
    setPreferences(current => ({ ...current, focusMode: focus }))
    setDrawingControl(current => ({ ...resolveDrawingControl(current, visibleWorkspacePanes(null, focus).map(p => p.id)), mode: IDLE_MODE }))
  }
  const sessionSlotEnabled = useSessionSlotsEnabled(overlaySettings.sessionSlots)

  const captureScreenshot = async () => {
    if (capturingRef.current || !captureRef.current) return
    capturingRef.current = true
    setCapturingScreenshot(true)
    try {
      // Freeze the displayed frame before opening the picker; do not await before requesting user activation.
      const canvas = captureWorkspace(captureRef.current)
      await saveWorkspaceScreenshot(canvas, screenshotFilename(SYMBOL, visiblePanes.length))
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error('Unable to save screenshot')
    } finally {
      capturingRef.current = false
      setCapturingScreenshot(false)
    }
  }

  const reloadMarketData = async () => {
    if (marketReloading) return
    setMarketReloading(true)
    try {
      await hardReloadMarketQueries(queryClient)
    } catch {
      toast.error('Failed to reload market data')
    } finally {
      setMarketReloading(false)
    }
  }

  return (
    <div data-workspace-fullscreen={fullScreen ? "true" : undefined} className="relative flex h-full min-h-0 flex-col overflow-hidden overscroll-none bg-background">
        <WorkspaceToolbar
          capturingScreenshot={capturingScreenshot} onCaptureScreenshot={() => void captureScreenshot()}
          preferences={preferences} onPreferencesChange={setPreferences} wideLayout={wideLayout}
          fullScreen={fullScreen}
          expanded={expanded} focusMode={focusMode} marketReloading={marketReloading}
          globalChartType={globalChartType}
          inspectorOpen={inspector.open} onFocusChange={changeFocus}
          favorites={favorites} onToggleFavorites={() => setFavorites(current => ({ ...current, visible: !current.visible }))} onEditFavorites={() => setEditFavorites(true)}
          drawingControl={control} onDrawingMode={chooseMode}
          onReloadMarketData={() => void reloadMarketData()}
          onResetLayout={() => setResetLayoutEpoch(current => current + 1)}
          onChartTypeChange={setGlobalChartType}
          onToggleInspector={() => { setDrawingControl(current => ({ ...current, mode: IDLE_MODE })); setInspector(toggleInspector) }}
          onFullscreen={() => setFullScreen(current => !current)}
        />
      {!fullScreen && <NonTradeWarningBanner />}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <WorkspaceLayout captureRef={captureRef} mode={workspaceLayoutMode(expanded, focusMode)} preferences={preferences}>
        {visiblePanes.map((pane) => {
          const isExpanded = expanded === pane.id
          const chartType = isExpanded
            ? (chartTypes[pane.id] ?? 'line')
            : globalChartType

          const compact = !isExpanded && !tablet
          const paneToggles = paneIndicators(overlaySettings, pane.id)
          const paneResetLayoutEpoch =
            (appliedResetLayoutEpochs[pane.id] ?? 0) < resetLayoutEpoch
              ? resetLayoutEpoch
              : 0
          return (
            <ChartPane
              key={pane.id}
              pane={pane}
              active={control.paneId === pane.id}
              keyboardEnabled={!inspector.open && !editFavorites}
              drawingMode={control.paneId === pane.id ? control.mode : IDLE_MODE}
              onActivate={() => selectPane(pane.id)}
              onCancelMode={(kind) => setDrawingControl(current => cancelPaneMode(current, pane.id, kind))}
              isExpanded={isExpanded}
              compact={compact}
              chartType={chartType}
              axesVisible={isExpanded || tablet}
              resetLayoutEpoch={paneResetLayoutEpoch}
              onResetLayoutApplied={(epoch) => {
                setAppliedResetLayoutEpochs((current) =>
                  current[pane.id] === epoch ? current : { ...current, [pane.id]: epoch },
                )
              }}
              showVolumeProfile={overlaySettings.volumeProfile}
              sessionSlotEnabled={sessionSlotEnabled}
              showBollinger={paneToggles.bollinger}
              showIchimoku={paneToggles.ichimoku}
              autoIndicatorsByRegime={overlaySettings.autoIndicatorsByRegime}
              onRegimeChange={onPaneRegimeChange}
              showRegime={paneToggles.regime}
              showForce={paneToggles.force}
              showEngulfing={paneToggles.engulfing}
              showDoji={paneToggles.doji}
              showDoublePattern={paneToggles.doublePattern}
              showKeyLevels={paneToggles.keyLevels}
              onChartType={(type) =>
                setChartTypes((current) => ({ ...current, [pane.id]: type }))
              }
              onToggleExpand={() => {
                setDrawingControl({ paneId: pane.id, mode: IDLE_MODE })
                setExpanded(current => current === pane.id ? null : pane.id)
                if (!isExpanded) setChartTypes(current => ({ ...current, [pane.id]: 'candlestick' }))
              }}
            />
          )
        })}
        </WorkspaceLayout>
        {!inspector.open && <FloatingFavoriteToolbar favorites={favorites} control={control} onMode={chooseMode} onHide={() => setFavorites(current => ({ ...current, visible: false }))} onEdit={() => setEditFavorites(true)} />}
        <WorkspaceInspector open={inspector.open} tab={inspector.tab} activePane={control.paneId}
          onTab={tab => setInspector(current => showInspector(current, tab))} onClose={() => setInspector(current => ({ ...current, open: false }))}
          settings={overlaySettings} autoRegimesByPane={autoRegimesByPane} onSettingsChange={setOverlaySettings} alertConfig={alertConfig} />
      </div>
      <FavoriteToolsDialog open={editFavorites} onOpenChange={setEditFavorites} favorites={favorites} onToggle={id => setFavorites(current => toggleFavorite(current, id))} />
      <ExecutionOrderDrawer
        open={executionOpen}
        onOpenChange={setExecutionOpen}
        symbol={SYMBOL}
      />
    </div>
  )
}

