'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMediaQuery } from 'usehooks-ts'
import { DASHBOARD_NOTES_QUERY_KEY, NotesSidebar } from '../notes/notes-sidebar'
import { loadDashboardNotes } from '../../_lib/notes/dashboard-notes'
import { GuidesSidebar } from '../guides/guides-sidebar'
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
import { ChartPane } from '../chart-pane/chart-pane'

const SMALL_SCREEN_QUERY = '(min-width: 1600px)'

export function TradingWorkspace() {
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
  const [notesOpen, setNotesOpen] = useState(false)
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
    if (!window.matchMedia("(max-width: 767px), (max-height: 500px)").matches) setNotesOpen(true)
  }, [notesQuery.isSuccess, notesQuery.data])
  const [guidesOpen, setGuidesOpen] = useState(false)
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
          preferences={preferences} onPreferencesChange={setPreferences} wideLayout={wideLayout}
          fullScreen={fullScreen}
          expanded={expanded} focusMode={focusMode} marketReloading={marketReloading}
          globalChartType={globalChartType} overlaySettings={overlaySettings} alertConfig={alertConfig}
          autoRegimesByPane={autoRegimesByPane} onSettingsChange={setOverlaySettings}
          notesOpen={notesOpen} onFocusChange={changeFocus}
          drawingControl={control} onDrawingMode={chooseMode}
          onReloadMarketData={() => void reloadMarketData()}
          onResetLayout={() => setResetLayoutEpoch(current => current + 1)}
          onChartTypeChange={setGlobalChartType}
          onToggleNotes={() => {
            setNotesOpen(open => {
              const next = !open
              if (next) setGuidesOpen(false)
              return next
            })
          }}
          onFullscreen={() => setFullScreen(current => !current)}
        />
      {!fullScreen && <NonTradeWarningBanner />}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <WorkspaceLayout mode={workspaceLayoutMode(expanded, focusMode)} preferences={preferences}>
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
                if (isExpanded) {
                  setExpanded(null)
                  return
                }
                setExpanded(pane.id)
                setChartTypes((current) => ({ ...current, [pane.id]: 'candlestick' }))
              }}
            />
          )
        })}
        </WorkspaceLayout>
        {notesOpen && <NotesSidebar symbol={SYMBOL} onClose={() => setNotesOpen(false)} />}
        {guidesOpen && <GuidesSidebar onClose={() => setGuidesOpen(false)} />}
      </div>
      <ExecutionOrderDrawer
        open={executionOpen}
        onOpenChange={setExecutionOpen}
        symbol={SYMBOL}
      />
    </div>
  )
}

