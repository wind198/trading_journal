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
  type ChartOverlaySettings,
  type DashboardPaneId,
} from '../../_lib/chart/chart-indicator-pane-settings'

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
}: {
  label: string
  onAll: () => void
  offAll: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <div className="flex gap-0.5">
        <Button type="button" variant="ghost" size="xs" className="h-6 px-1.5" onClick={onAll}>
          All on
        </Button>
        <Button type="button" variant="ghost" size="xs" className="h-6 px-1.5" onClick={offAll}>
          All off
        </Button>
      </div>
    </div>
  )
}

export function ChartOverlaySettingsMenu({
  settings,
  onSettingsChange,
}: ChartOverlaySettingsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Chart overlay settings">
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
        <IndicatorBulkRow
          label="Bollinger"
          onAll={() =>
            onSettingsChange((current) => setIndicatorAllPanes(current, 'bollinger', true))
          }
          offAll={() =>
            onSettingsChange((current) => setIndicatorAllPanes(current, 'bollinger', false))
          }
        />
        <IndicatorBulkRow
          label="Ichimoku"
          onAll={() =>
            onSettingsChange((current) => setIndicatorAllPanes(current, 'ichimoku', true))
          }
          offAll={() =>
            onSettingsChange((current) => setIndicatorAllPanes(current, 'ichimoku', false))
          }
        />
        <div
          className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2 px-2 py-2 text-xs text-muted-foreground"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <span />
          <span className="text-center font-medium text-foreground">Bollinger</span>
          <span className="text-center font-medium text-foreground">Ichimoku</span>
          {DASHBOARD_PANE_IDS.map((paneId) => (
            <div key={paneId} className="contents">
              <span className="font-medium text-foreground">{PANE_LABELS[paneId]}</span>
              <label className="flex justify-center">
                <Checkbox
                  checked={settings.indicatorsByPane[paneId].bollinger}
                  onCheckedChange={(checked) =>
                    onSettingsChange((current) =>
                      setPaneIndicator(current, paneId, 'bollinger', checked === true),
                    )
                  }
                  aria-label={`Bollinger on ${paneId}`}
                />
              </label>
              <label className="flex justify-center">
                <Checkbox
                  checked={settings.indicatorsByPane[paneId].ichimoku}
                  onCheckedChange={(checked) =>
                    onSettingsChange((current) =>
                      setPaneIndicator(current, paneId, 'ichimoku', checked === true),
                    )
                  }
                  aria-label={`Ichimoku on ${paneId}`}
                />
              </label>
            </div>
          ))}
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