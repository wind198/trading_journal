'use client'

import { useMemo } from 'react'
import { useLocalStorage } from 'usehooks-ts'
import { Button } from '@/components/ui/button'
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
  defaultSessionSlotEnabled,
  sessionSlotId,
  sessionSlotLabel,
  type SessionSlotId,
} from '../../_lib/chart/chart-timezone'

export type ChartOverlaySettings = {
  volumeProfile: boolean
  sessionSlots: Record<SessionSlotId, boolean>
}

const STORAGE_KEY = 'trading-dashboard.chart-overlay-settings'

export const DEFAULT_OVERLAY_SETTINGS: ChartOverlaySettings = {
  volumeProfile: true,
  sessionSlots: defaultSessionSlotEnabled(),
}

function parseOverlaySettings(raw: string): ChartOverlaySettings {
  try {
    const parsed = JSON.parse(raw) as Partial<ChartOverlaySettings>
    const defaults = defaultSessionSlotEnabled()
    const slots = { ...defaults }
    if (parsed.sessionSlots && typeof parsed.sessionSlots === 'object') {
      for (const id of Object.keys(defaults) as SessionSlotId[]) {
        const value = parsed.sessionSlots[id]
        if (typeof value === 'boolean') slots[id] = value
      }
    }
    return {
      volumeProfile:
        typeof parsed.volumeProfile === 'boolean'
          ? parsed.volumeProfile
          : DEFAULT_OVERLAY_SETTINGS.volumeProfile,
      sessionSlots: slots,
    }
  } catch {
    return DEFAULT_OVERLAY_SETTINGS
  }
}

export function useChartOverlaySettings() {
  return useLocalStorage<ChartOverlaySettings>(STORAGE_KEY, DEFAULT_OVERLAY_SETTINGS, {
    initializeWithValue: false,
    deserializer: parseOverlaySettings,
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
      <DropdownMenuContent align="end" className="min-w-48">
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function useSessionSlotsEnabled(
  sessionSlots: ChartOverlaySettings['sessionSlots'],
): ReadonlySet<string> {
  return useMemo(() => sessionSlotsEnabledSet(sessionSlots), [sessionSlots])
}
