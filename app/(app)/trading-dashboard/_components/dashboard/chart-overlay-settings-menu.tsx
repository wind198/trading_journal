'use client'

import { useMemo } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Settings2 } from 'lucide-react'
import {
  SESSION_LINE_SLOTS,
  sessionSlotId,
  sessionSlotLabel,
} from '../../_lib/chart/chart-timezone'
import {
  DASHBOARD_PANE_IDS,
  DEFAULT_OVERLAY_SETTINGS,
  parseChartOverlaySettings,
  setIndicatorAllPanes,
  setPaneIndicator,
  regimeIndicatorVisibility,
  type ChartOverlaySettings,
  type DashboardPaneId,
} from '../../_lib/chart/chart-indicator-pane-settings'
import type { Regime } from '../../_lib/overlays/baseline-indicators'
import type { useAlertConfig } from '../../_hooks/useAlertConfig'

export type { ChartOverlaySettings }

const STORAGE_KEY = 'trading-dashboard.chart-overlay-settings'

export function useChartOverlaySettings() {
  return useLocalStorage<ChartOverlaySettings>(STORAGE_KEY, DEFAULT_OVERLAY_SETTINGS, {
    initializeWithValue: false,
    deserializer: parseChartOverlaySettings,
  })
}

export function sessionSlotsEnabledSet(
  sessionSlots: ChartOverlaySettings['sessionSlots'],
): ReadonlySet<string> {
  const enabled = new Set<string>()
  for (const [id, on] of Object.entries(sessionSlots)) {
    if (on) enabled.add(id)
  }
  return enabled
}

type ChartOverlaySettingsMenuProps = {
  settings: ChartOverlaySettings
  alertConfig: ReturnType<typeof useAlertConfig>
  autoRegimesByPane: Partial<Record<DashboardPaneId, Regime | null>>
  onSettingsChange: (
    update: ChartOverlaySettings | ((current: ChartOverlaySettings) => ChartOverlaySettings),
  ) => void
}

const PANE_LABELS: Record<DashboardPaneId, string> = {
  '4h': '4h',
  '1h': '1h',
  '15m': '15m',
  '3m': '3m',
}

function IndicatorBulkRow({
  label,
  onAll,
  offAll,
  manualDisabled = false,
  auto,
}: {
  label: string
  onAll: () => void
  offAll: () => void
  manualDisabled?: boolean
  auto?: { enabled: boolean; onToggle: () => void }
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="flex gap-0.5">
        {auto && (
          <Button
            type="button"
            variant={auto.enabled ? 'secondary' : 'ghost'}
            size="xs"
            className="h-6 px-1.5"
            aria-label="Auto Bollinger and Ichimoku by regime"
            aria-pressed={auto.enabled}
            onClick={auto.onToggle}
          >
            Auto
          </Button>
        )}
        <Button type="button" variant="ghost" size="xs" className="h-6 px-1.5" onClick={onAll} disabled={manualDisabled}>
          All on
        </Button>
        <Button type="button" variant="ghost" size="xs" className="h-6 px-1.5" onClick={offAll} disabled={manualDisabled}>
          All off
        </Button>
      </div>
    </div>
  )
}

const INDICATORS = [
  ['bollinger', 'Bollinger'],
  ['ichimoku', 'Ichimoku'],
  ['regime', 'Regime'],
  ['force', 'Force candles'],
  ['engulfing', 'Engulfing'],
  ['doji', 'Doji'],
  ['doublePattern', 'Double pattern'],
  ['keyLevels', 'Key levels'],
] as const

export function ChartOverlaySettingsMenu({
  settings,
  alertConfig,
  autoRegimesByPane,
  onSettingsChange,
}: ChartOverlaySettingsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="size-9" aria-label="Chart overlay settings">
          <Settings2 />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        <DropdownMenuLabel>Overlays</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={settings.volumeProfile}
          onCheckedChange={(checked) =>
            onSettingsChange((current) => ({
              ...current,
              volumeProfile: checked === true,
            }))
          }
          onSelect={(event) => event.preventDefault()}
        >
          Volume profile
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Session lines</DropdownMenuLabel>
        {SESSION_LINE_SLOTS.map((slot) => {
          const id = sessionSlotId(slot)
          return (
            <DropdownMenuCheckboxItem
              key={id}
              checked={settings.sessionSlots[id] ?? true}
              onCheckedChange={(checked) =>
                onSettingsChange((current) => ({
                  ...current,
                  sessionSlots: {
                    ...current.sessionSlots,
                    [id]: checked === true,
                  },
                }))
              }
              onSelect={(event) => event.preventDefault()}
            >
              {sessionSlotLabel(slot)}
            </DropdownMenuCheckboxItem>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Indicators</DropdownMenuLabel>
        {/* {INDICATORS.map(([key, label]) => (
          <IndicatorBulkRow
            key={key}
            label={label}
            manualDisabled={settings.autoIndicatorsByRegime && (key === 'bollinger' || key === 'ichimoku')}
            auto={key === 'bollinger' ? {
              enabled: settings.autoIndicatorsByRegime,
              onToggle: () => onSettingsChange((current) => ({
                ...current,
                autoIndicatorsByRegime: !current.autoIndicatorsByRegime,
              })),
            } : undefined}
            onAll={() => onSettingsChange((current) => setIndicatorAllPanes(current, key, true))}
            offAll={() => onSettingsChange((current) => setIndicatorAllPanes(current, key, false))}
          />
        ))} */}
        <div
          className="grid grid-cols-[auto_repeat(4,1fr)] items-center gap-x-3 gap-y-2 px-2 py-2 text-xs text-muted-foreground"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span />
          {DASHBOARD_PANE_IDS.map((paneId) => <span key={paneId} className="text-center font-medium text-foreground">{PANE_LABELS[paneId]}</span>)}
          {INDICATORS.map(([key, label]) => (
            <div key={key} className="contents">
              <span className="font-medium text-foreground">{label}</span>
              {DASHBOARD_PANE_IDS.map((paneId) => (
                <label key={paneId} className="flex justify-center">
                  <Checkbox
                    checked={
                      key === 'regime' && (paneId === '4h' || paneId === '1h')
                        ? false
                        : (key === 'bollinger' || key === 'ichimoku') && settings.autoIndicatorsByRegime
                          ? regimeIndicatorVisibility(
                              true,
                              autoRegimesByPane[paneId] ?? null,
                              settings.indicatorsByPane[paneId],
                            )[key]
                        : settings.indicatorsByPane[paneId][key]
                    }
                    disabled={
                      (key === 'regime' && (paneId === '4h' || paneId === '1h')) ||
                      (settings.autoIndicatorsByRegime && (key === 'bollinger' || key === 'ichimoku'))
                    }
                    onCheckedChange={(checked) => onSettingsChange((current) => setPaneIndicator(current, paneId, key, checked === true))}
                    aria-label={`${label} on ${paneId}`}
                  />
                </label>
              ))}
            </div>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Alert config</DropdownMenuLabel>
        <div className="space-y-2 px-2 py-2 text-xs" onPointerDown={(event) => event.stopPropagation()}>
          {([
            ['forceCandle', 'Force candle'],
            ['doublePattern', 'Double pattern'],
            ['engulfing', 'Engulfing'],
            ['doji', 'High-quality Doji'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4">
              <span>{label}</span>
              <Checkbox
                checked={alertConfig.config[key]}
                disabled={alertConfig.loading || alertConfig.saving || alertConfig.error === 'Sign in to edit alert config' || (alertConfig.error?.startsWith('Unable to load') ?? false)}
                onCheckedChange={(checked) => alertConfig.setAlert(key, checked === true)}
                aria-label={`${label} alert`}
              />
            </label>
          ))}
          {alertConfig.loading && <p className="text-muted-foreground">Loading alert config…</p>}
          {alertConfig.saving && <p className="text-muted-foreground">Saving alert config…</p>}
          {alertConfig.error && (
            <div className="flex items-center gap-2 text-destructive" role="alert">
              <span>{alertConfig.error}</span>
              {alertConfig.error.startsWith('Unable to load') && (
                <Button type="button" variant="ghost" size="xs" onClick={() => void alertConfig.reload()}>
                  Retry
                </Button>
              )}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function useSessionSlotsEnabled(
  sessionSlots: ChartOverlaySettings['sessionSlots'],
): ReadonlySet<string> {
  return useMemo(() => sessionSlotsEnabledSet(sessionSlots), [sessionSlots])
}
